' electron/alarm.vbs
Dim message, mp3Path
If WScript.Arguments.Count > 0 Then message = WScript.Arguments(0)
mp3Path = "C:\Path\To\Your\Project\public\alarm.mp3" ' <--- UPDATE THIS PATH

Set WshShell = CreateObject("WScript.Shell")
' Open the mp3 file
WshShell.Run "wmplayer.exe /play /close """ & mp3Path & """", 0, False
' Show the popup
WshShell.Popup message, 60, "Aura Alarm", 64