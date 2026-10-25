import React, { useState, useEffect, useRef } from "react";
import { 
  FaCloudArrowUp, 
  FaTrash, 
  FaXmark, 
  FaPlay, 
  FaImage, 
  FaMagnifyingGlass,
  FaDownload,
  FaVideo
} from "react-icons/fa6";
import { supabase } from "../../supabase/supabase-cllient";
import "../css/AuraMediaVault.css";

const MEDIA_BUCKET = "aura-media";

interface MediaFile {
  name: string;
  url: string;
  type: "image" | "video";
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
          return {
            name: file.name,
            url: publicUrl,
            type: isVideo ? "video" : "image",
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
      // Clean up filename for a nicer display
      const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "-");
      const fileName = `${baseName}-${Date.now().toString().slice(-4)}.${fileExt}`;
      
      const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(fileName, file);
      if (error) throw error;
      
      await fetchFiles(); 
    } catch (err) {
      console.error("Error uploading:", err);
      alert("Failed to upload media.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (e: React.MouseEvent, fileName: string) => {
    e.stopPropagation(); // Prevent opening the image viewer when deleting
    if (!window.confirm("Delete this file permanently?")) return;
    try {
      const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([fileName]);
      if (error) throw error;
      setFiles((prev) => prev.filter((f) => f.name !== fileName));
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

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
          accept="image/*,video/*"
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

      {/* ── Media Grid ───────────────────────────────────────── */}
      <div className="aura-vault-grid-container">
        {isLoading ? (
          <div className="aura-vault-empty">Loading your archive...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="aura-vault-empty">
            {searchQuery ? "No files match your search." : "No media found. Upload something!"}
          </div>
        ) : (
          <div className="aura-vault-grid">
            {filteredFiles.map((file) => (
              <div 
                key={file.name} 
                className="aura-vault-item"
                onClick={() => setSelectedFile(file)}
              >
                <div className="aura-vault-thumb">
                  {file.type === "image" ? (
                    <img src={file.url} alt={file.name} loading="lazy" />
                  ) : (
                    <div className="aura-vault-video">
                      <video src={file.url} />
                      <div className="aura-vault-play-icon"><FaPlay /></div>
                    </div>
                  )}
                </div>
                
                <div className="aura-vault-info">
                  <span className="aura-vault-name" title={file.name}>{file.name}</span>
                  <span className="aura-vault-meta">
                    {file.type === "image" ? <FaImage /> : <FaVideo />} 
                    {formatDate(file.created_at)}
                  </span>
                </div>

                <button
                  type="button"
                  className="aura-vault-delete"
                  onClick={(e) => handleDelete(e, file.name)}
                  title="Delete file"
                >
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
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
            ) : (
              <video src={selectedFile.url} controls autoPlay />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuraMediaVault;