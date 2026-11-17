import { useState, useRef, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  Upload,
  FileText,
  FileCode,
  FileImage,
  FileArchive,
  Download,
  Trash2,
  ExternalLink,
  Plus,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  originalName: string;
  size?: number;
  contentType?: string;
  uploadDate?: string;
}

interface BackendGridFSFile {
  _id: string;
  filename: string;
  contentType?: string;
  length?: number;
  uploadDate?: string;
  metadata?: {
    originalName?: string;
    size?: number;
  };
}

interface LinkItem {
  id: number;
  title: string;
  url: string;
  category: string;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes === 0) return "Unknown size";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getFileIcon = (contentType?: string, name?: string) => {
  const mime = (contentType || "").toLowerCase();
  const filename = (name || "").toLowerCase();

  if (mime.includes("image") || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(filename)) {
    return <FileImage className="w-8 h-8 text-cyan-400" />;
  }
  if (
    mime.includes("zip") ||
    mime.includes("tar") ||
    mime.includes("compressed") ||
    /\.(zip|tar|gz|rar)$/.test(filename)
  ) {
    return <FileArchive className="w-8 h-8 text-amber-400" />;
  }
  if (
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    /\.(js|ts|tsx|jsx|json|py|html|css)$/.test(filename)
  ) {
    return <FileCode className="w-8 h-8 text-purple-400" />;
  }
  return <FileText className="w-8 h-8 text-emerald-400" />;
};

export default function Files() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([
    {
      id: 1,
      title: "Tailwind CSS Documentation",
      url: "https://tailwindcss.com/docs",
      category: "Design Reference",
    },
    {
      id: 2,
      title: "Chart.js Examples & API",
      url: "https://www.chartjs.org/docs/latest/samples/",
      category: "Frontend Lib",
    },
    {
      id: 3,
      title: "Next.js 14 Documentation",
      url: "https://nextjs.org/docs",
      category: "Framework",
    },
  ]);

  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkCategory, setNewLinkCategory] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

  const getAuthHeaders = (): Record<string, string> => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const showNotification = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Fetch all team files
  const fetchFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const res = await fetch(`${API_BASE}/files/files`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const data: BackendGridFSFile[] = await res.json();
        if (Array.isArray(data)) {
          setFiles(
            data.map((f) => ({
              id: f._id,
              name: f.filename,
              originalName: f.metadata?.originalName || f.filename.replace(/^\d+-/, ""),
              size: f.metadata?.size || f.length,
              contentType: f.contentType,
              uploadDate: f.uploadDate,
            }))
          );
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.warn("Files fetch error:", errorData);
      }
    } catch (err) {
      console.error("Error fetching files:", err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // File Upload with validation
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be re-selected if needed
    event.target.value = "";

    // 10MB limit validation
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showNotification(
        "error",
        `File "${file.name}" exceeds the 10MB limit (${formatFileSize(file.size)}).`
      );
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const res = await fetch(`${API_BASE}/files/upload`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showNotification("success", `"${file.name}" uploaded successfully!`);
        fetchFiles();
      } else {
        showNotification(
          "error",
          data.message || "Failed to upload file. Please check team membership."
        );
      }
    } catch (err) {
      console.error("File upload error:", err);
      showNotification("error", "Network error occurred during file upload.");
    } finally {
      setIsUploading(false);
    }
  };

  // Download file
  const handleDownloadFile = async (filename: string, originalName: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/files/file/${encodeURIComponent(filename)}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) {
        throw new Error("Download request rejected");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = originalName || filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      showNotification("error", "Unable to download file. Please try again.");
    }
  };

  // Delete file
  const handleDeleteFile = async (filename: string, originalName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${originalName || filename}"?`
      )
    ) {
      return;
    }

    setDeletingFilename(filename);
    try {
      const res = await fetch(
        `${API_BASE}/files/file/${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showNotification("success", "File removed successfully!");
        setFiles((prev) => prev.filter((f) => f.name !== filename));
      } else {
        showNotification("error", data.message || "Failed to delete file.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      showNotification("error", "Network error deleting file.");
    } finally {
      setDeletingFilename(null);
    }
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;

    let formattedUrl = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const newLink: LinkItem = {
      id: Date.now(),
      title: newLinkTitle.trim(),
      url: formattedUrl,
      category: newLinkCategory.trim() || "General",
    };

    setLinks((prev) => [...prev, newLink]);
    setShowAddLinkModal(false);
    showNotification("success", "Link saved to team repository!");
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-display-md font-display text-gradient-primary mb-1 text-glow">
            Files & Repository
          </h2>
          <p className="text-body-sm font-body text-zinc-400 max-w-2xl">
            Secure, team-isolated document store for project specs, slide decks,
            assets, and important links.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchFiles()}
            disabled={isLoadingFiles}
            className="btn-secondary text-sm px-3 py-2 flex items-center gap-2"
            title="Refresh files"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoadingFiles ? "animate-spin text-cyan-400" : ""}`}
            />
            <span>Refresh</span>
          </button>
          <button
            onClick={triggerFileSelect}
            disabled={isUploading}
            className="btn-primary flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload File</span>
              </>
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div
          className={`mb-6 p-3.5 rounded-xl border flex items-center gap-2.5 transition-all text-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
              : "bg-rose-500/20 border-rose-500/40 text-rose-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Uploaded Files Section */}
      <div className="card mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-heading-lg font-heading text-white">Team Files</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300">
              {files.length}
            </span>
          </div>
          <span className="text-xs text-zinc-400">Max size: 10MB per file</span>
        </div>

        {isLoadingFiles ? (
          <div className="py-12 text-center">
            <div className="loader mx-auto mb-2"></div>
            <p className="text-xs text-zinc-400">Loading team repository...</p>
          </div>
        ) : files.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="glass rounded-xl p-4 transition-all duration-300 hover:border-cyan-500/40 flex flex-col justify-between relative group"
              >
                <button
                  type="button"
                  onClick={() => handleDeleteFile(file.name, file.originalName)}
                  disabled={deletingFilename === file.name}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Delete file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3 mb-3 pr-6">
                  <div className="p-2 rounded-lg bg-zinc-800/80 shrink-0">
                    {getFileIcon(file.contentType, file.originalName)}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="font-medium text-sm text-white truncate"
                      title={file.originalName}
                    >
                      {file.originalName}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadFile(file.name, file.originalName)}
                  className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-1.5 mt-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center rounded-xl border border-dashed border-zinc-800">
            <Upload className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-300">
              No files uploaded yet
            </p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
              Share project specs, architecture diagrams, datasets, and pitch decks
              with your teammates.
            </p>
            <button
              onClick={triggerFileSelect}
              className="btn-primary text-xs px-4 py-2"
            >
              Upload First File
            </button>
          </div>
        )}
      </div>

      {/* Saved Important Links */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-heading-lg font-heading text-white">
              Saved Important Links
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300">
              {links.length}
            </span>
          </div>
          <button
            onClick={() => setShowAddLinkModal(true)}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Link</span>
          </button>
        </div>

        <ul className="space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="glass rounded-xl flex items-center justify-between p-3.5 transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <ExternalLink className="w-4 h-4 text-cyan-400 shrink-0" />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-cyan-300 font-medium text-sm truncate underline-offset-4 hover:underline"
                >
                  {link.title}
                </a>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800/80 text-zinc-300 shrink-0">
                {link.category}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Add Link Modal */}
      {showAddLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="card w-full max-w-md border border-cyan-500/30">
            <h2 className="text-heading-xl font-heading mb-4 text-white">
              Add Team Resource Link
            </h2>
            <form onSubmit={handleAddLink} className="space-y-4">
              <div>
                <label className="label-enhanced">Link Title *</label>
                <input
                  type="text"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  className="input-enhanced w-full text-white placeholder-zinc-500"
                  placeholder="e.g. API Documentation"
                  required
                />
              </div>
              <div>
                <label className="label-enhanced">URL *</label>
                <input
                  type="url"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className="input-enhanced w-full text-white placeholder-zinc-500"
                  placeholder="https://..."
                  required
                />
              </div>
              <div>
                <label className="label-enhanced">Category</label>
                <input
                  type="text"
                  value={newLinkCategory}
                  onChange={(e) => setNewLinkCategory(e.target.value)}
                  className="input-enhanced w-full text-white placeholder-zinc-500"
                  placeholder="e.g. Design, Backend, API"
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLinkModal(false)}
                  className="w-full btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="w-full btn-primary">
                  Save Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
