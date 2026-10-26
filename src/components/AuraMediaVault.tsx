import React, { useState, useEffect, useRef } from "react";
import { 
  FaCloudArrowUp, 
  FaTrash, 
  FaXmark, 
  FaPlay, 
  FaImage, 
  FaMagnifyingGlass,
  FaDownload,
  FaVideo,
  FaPencil,
  FaFileLines
} from "react-icons/fa6";
import { supabase } from "../../supabase/supabase-client";
import { extractTextFromFile } from "../api/file-extractor"; // Ensure this is created
import "../css/AuraMediaVault.css";

const MEDIA_BUCKET = "aura-media";

interface MediaFile {
  name: string;
  url: string;
  type: "image" | "video" | "document";
  created_at: string;
  size: number;
}

interface AuraMediaVaultProps {
  onClose: () => void;
  lightMode: boolean;
}

const AuraMediaVault: React.FC<AuraMediaVaultProps> = ({ onClose, lightMode }) => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<MediaFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // State for the full-screen viewer
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);

  // ── States for Custom Modals ──
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameExt, setRenameExt] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.storage.from(MEDIA_BUCKET).list();
      if (error) throw error;

      const mediaFiles = data
        .filter((file: any) => file.name !== ".emptyFolderPlaceholder")
        .map((file: any) => {
          const { data: { publicUrl } } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(file.name);
          const isVideo = file.name.match(/\.(mp4|webm|ogg|mov)$/i);
          const isDoc = file.name.match(/\.(pdf|txt|doc|docx|csv|xls|xlsx)$/i);
          
          return {
            name: file.name,
            url: publicUrl,
            type: isVideo ? "video" : isDoc ? "document" : "image",
            created_at: file.created_at || new Date().toISOString(),
            size: file.metadata?.size || 0,
          };
        })
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setFiles(mediaFiles as MediaFile[]);
      setFilteredFiles(mediaFiles as MediaFile[]);
    } catch (err) {
      console.error("Error fetching media:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Handle Search Filtering
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files);
    } else {
      const lowerQ = searchQuery.toLowerCase();
      setFilteredFiles(files.filter((f) => f.name.toLowerCase().includes(lowerQ)));
    }
  }, [searchQuery, files]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const baseName = file.name.replace(/\.[^/.]+$/, ""); 
      const safeBaseName = baseName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9\-_]/g, "");
      const fileName = `${safeBaseName}.${fileExt}`;
      
      const isDoc = /\.(pdf|txt|docx|xlsx|csv|md)$/i.test(file.name);
      let extractedText = "";

      // Extract text if it's a document
      if (isDoc) {
        extractedText = await extractTextFromFile(file);
      }

      // 1. Upload raw file to Storage
      const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(fileName, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type
      });
      
      if (uploadError) throw uploadError;

      // 2. Save extracted text to Database
      if (isDoc && extractedText) {
        const { data: { publicUrl } } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(fileName);
        
        const { error: dbError } = await supabase.from("documents").upsert({
          file_name: fileName,
          file_url: publicUrl,
          extracted_text: extractedText
        }, { onConflict: 'file_name' });

        if (dbError) console.error("Error saving document text to DB:", dbError);
      }
      
      await fetchFiles(); 
    } catch (err) {
      console.error("Error uploading:", err);
      alert("Failed to upload media. Check if the filename is valid.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsLoading(true);
      
      // 1. Delete file from Storage
      const { error: storageError } = await supabase.storage.from(MEDIA_BUCKET).remove([deleteTarget]);
      if (storageError) throw storageError;

      // 2. Delete document text from Database
      await supabase.from("documents").delete().eq("file_name", deleteTarget);
      
      setFiles((prev) => prev.filter((f) => f.name !== deleteTarget));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Error deleting:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmRename = async () => {
    if (!renameTarget || !renameInput.trim()) {
      setRenameTarget(null);
      return;
    }

    const safeBaseName = renameInput.trim().replace(/\.[^/.]+$/, "").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9\-_]/g, "");
    const finalName = `${safeBaseName}${renameExt}`;

    if (finalName === renameTarget) {
      setRenameTarget(null);
      return;
    }

    try {
      setIsLoading(true);
      
      // 1. Rename file in Storage
      const { error } = await supabase.storage.from(MEDIA_BUCKET).move(renameTarget, finalName);
      if (error) throw error;

      // 2. Update filename in Database
      await supabase.from("documents").update({ file_name: finalName }).eq("file_name", renameTarget);
      
      await fetchFiles(); 
      setRenameTarget(null);
    } catch (err: any) {
      console.error("Error renaming file:", err);
      alert(`Failed to rename file: ${err.message || "Make sure the name is unique."}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ── Organize files by type ──
  const images = filteredFiles.filter(f => f.type === "image");
  const videos = filteredFiles.filter(f => f.type === "video");
  const documents = filteredFiles.filter(f => f.type === "document");

  // Helper component to render a single file card
  const FileCard = ({ file }: { file: MediaFile }) => (
    <div 
      className="aura-vault-item"
      onClick={() => setSelectedFile(file)}
    >
      <div className="aura-vault-thumb">
        {file.type === "image" ? (
          <img src={file.url} alt={file.name} loading="lazy" />
        ) : file.type === "video" ? (
          <div className="aura-vault-video">
            <video src={file.url} />
            <div className="aura-vault-play-icon"><FaPlay /></div>
          </div>
        ) : (
          <div className="aura-vault-doc">
            <FaFileLines size={40} color="var(--aura-violet)" />
            <span>Document</span>
          </div>
        )}
      </div>
      
      <div className="aura-vault-info">
        <span className="aura-vault-name" title={file.name}>{file.name}</span>
        <span className="aura-vault-meta">
          {file.type === "image" ? <FaImage /> : file.type === "video" ? <FaVideo /> : <FaFileLines />} 
          {formatDate(file.created_at)}
        </span>
      </div>

      <button
        type="button"
        className="aura-vault-delete delete-btn"
        onClick={(e) => { e.stopPropagation(); setDeleteTarget(file.name); }}
        title="Delete file"
      >
        <FaTrash size={12} />
      </button>

      <button
        type="button"
        className="aura-vault-delete rename-btn"
        onClick={(e) => {
          e.stopPropagation();
          setRenameTarget(file.name);
          const lastDotIndex = file.name.lastIndexOf('.');
          if (lastDotIndex !== -1) {
            setRenameInput(file.name.substring(0, lastDotIndex));
            setRenameExt(file.name.substring(lastDotIndex));
          } else {
            setRenameInput(file.name);
            setRenameExt("");
          }
        }}
        title="Rename file"
      >
        <FaPencil size={12} />
      </button>
    </div>
  );

  return (
    <div className={`aura-vault ${lightMode ? "aura-vault-light" : ""}`}>
      
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="aura-vault-header">
        <div className="aura-vault-title">
          <FaImage />
          <h2>Media Vault</h2>
        </div>
        <div className="aura-vault-header-actions">
          <div className="aura-vault-search-wrap">
            <FaMagnifyingGlass />
            <input 
              type="text" 
              placeholder="Search files..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="button" className="aura-vault-close" onClick={onClose}>
            <FaXmark />
          </button>
        </div>
      </div>

      {/* ── Upload Area ──────────────────────────────────────── */}
      <div className="aura-vault-upload">
        <input
          type="file"
          accept="image/*,video/*,.pdf,.txt,.doc,.docx,.csv,.xls,.xlsx"
          ref={fileInputRef}
          onChange={handleUpload}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="aura-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <FaCloudArrowUp />
          {isUploading ? "UPLOADING..." : "UPLOAD NEW MEDIA"}
        </button>
      </div>

      {/* ── Media Grids (Organized by Category) ───────────────── */}
      <div className="aura-vault-grid-container">
        {isLoading ? (
          <div className="aura-vault-empty">Loading your archive...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="aura-vault-empty">
            {searchQuery ? "No files match your search." : "No media found. Upload something!"}
          </div>
        ) : (
          <>
            {/* IMAGES SECTION */}
            {images.length > 0 && (
              <div className="aura-vault-section">
                <h3 className="aura-vault-section-title">
                  <FaImage /> Images ({images.length})
                </h3>
                <div className="aura-vault-grid">
                  {images.map((file) => <FileCard key={file.name} file={file} />)}
                </div>
              </div>
            )}

            {/* VIDEOS SECTION */}
            {videos.length > 0 && (
              <div className="aura-vault-section">
                <h3 className="aura-vault-section-title">
                  <FaVideo /> Videos ({videos.length})
                </h3>
                <div className="aura-vault-grid">
                  {videos.map((file) => <FileCard key={file.name} file={file} />)}
                </div>
              </div>
            )}

            {/* DOCUMENTS SECTION */}
            {documents.length > 0 && (
              <div className="aura-vault-section">
                <h3 className="aura-vault-section-title">
                  <FaFileLines /> Documents ({documents.length})
                </h3>
                <div className="aura-vault-grid">
                  {documents.map((file) => <FileCard key={file.name} file={file} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Full-Screen Media Viewer (Lightbox) ──────────────── */}
      {selectedFile && (
        <div 
          className="aura-vault-lightbox"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedFile(null);
          }}
        >
          <div className="aura-vault-lightbox-header">
            <h3>{selectedFile.name}</h3>
            <div className="aura-lightbox-actions">
              <a href={selectedFile.url} download target="_blank" rel="noreferrer" title="Download">
                <FaDownload />
              </a>
              <button onClick={() => setSelectedFile(null)} title="Close">
                <FaXmark />
              </button>
            </div>
          </div>
          <div className="aura-vault-lightbox-content">
            {selectedFile.type === "image" ? (
              <img src={selectedFile.url} alt={selectedFile.name} />
            ) : selectedFile.type === "video" ? (
              <video src={selectedFile.url} controls autoPlay />
            ) : (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <FaFileLines size={80} color="var(--aura-violet)" style={{ marginBottom: "20px" }} />
                <h2>{selectedFile.name}</h2>
                <p style={{ color: "var(--aura-muted)", marginBottom: "20px" }}>
                  This is a document file. Download it to view, or ask Aura to read and summarize it for you.
                </p>
                <a 
                  href={selectedFile.url} 
                  download 
                  target="_blank" 
                  rel="noreferrer"
                  className="aura-upload-btn"
                  style={{ display: "inline-flex", textDecoration: "none" }}
                >
                  <FaDownload /> DOWNLOAD FILE
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CUSTOM DELETE MODAL ──────────────────────────────── */}
      {deleteTarget && (
        <div className="aura-vault-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="aura-vault-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aura-vault-modal-icon danger"><FaTrash /></div>
            <h3>Delete File?</h3>
            <p>Are you sure you want to permanently delete <strong>{deleteTarget}</strong>? This cannot be undone.</p>
            <div className="aura-vault-modal-actions">
              <button className="cancel-btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="confirm-btn danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM RENAME MODAL ──────────────────────────────── */}
      {renameTarget && (
        <div className="aura-vault-modal-overlay" onClick={() => setRenameTarget(null)}>
          <div className="aura-vault-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aura-vault-modal-icon"><FaPencil /></div>
            <h3>Rename File</h3>
            <p>Enter a new name for this file. The extension cannot be changed.</p>
            
            <div className="aura-vault-modal-input-wrap">
              <input 
                type="text" 
                className="aura-vault-modal-input"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmRename();
                  if (e.key === "Escape") setRenameTarget(null);
                }}
              />
              <span className="aura-vault-modal-ext">
                {renameExt}
              </span>
            </div>

            <div className="aura-vault-modal-actions">
              <button className="cancel-btn" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button className="confirm-btn" onClick={confirmRename}>Save</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AuraMediaVault;