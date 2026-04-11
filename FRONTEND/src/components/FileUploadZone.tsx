/**
 * src/components/FileUploadZone.tsx
 * Reusable drag-and-drop + click-to-browse file upload zone.
 * Supports preview (images), file name display, and removal.
 */
import { useRef, useState, useCallback } from "react";
import { Upload, X, FileText, CheckCircle2 } from "lucide-react";

interface FileUploadZoneProps {
    accept?: string;          // e.g. ".pdf,.jpg,.jpeg,.png"
    maxSizeMB?: number;
    hint?: string;            // shown below the icon
    multiple?: boolean;
    onFilesChange?: (files: File[]) => void;
    className?: string;
    accentClass?: string;     // tailwind colour token e.g. "primary" | "marrow"
}

export default function FileUploadZone({
    accept = ".pdf,.jpg,.jpeg,.png",
    maxSizeMB = 5,
    hint,
    multiple = false,
    onFilesChange,
    className = "",
    accentClass = "primary",
}: FileUploadZoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState("");

    const maxBytes = maxSizeMB * 1024 * 1024;

    const addFiles = useCallback((incoming: FileList | null) => {
        if (!incoming) return;
        setError("");
        const valid: File[] = [];
        Array.from(incoming).forEach((f) => {
            if (f.size > maxBytes) {
                setError(`"${f.name}" exceeds ${maxSizeMB} MB limit.`);
            } else {
                valid.push(f);
            }
        });
        const next = multiple ? [...files, ...valid] : valid.slice(0, 1);
        setFiles(next);
        onFilesChange?.(next);
    }, [files, maxBytes, maxSizeMB, multiple, onFilesChange]);

    const remove = (idx: number) => {
        const next = files.filter((_, i) => i !== idx);
        setFiles(next);
        onFilesChange?.(next);
        // reset the hidden input so the same file can be re-selected
        if (inputRef.current) inputRef.current.value = "";
    };

    const isImage = (f: File) => f.type.startsWith("image/");

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Drop zone */}
            <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    addFiles(e.dataTransfer.files);
                }}
                className={`
          relative border-2 border-dashed rounded-xl p-6 text-center
          cursor-pointer transition-all select-none outline-none
          focus-visible:ring-2 focus-visible:ring-offset-2
          ${dragging
                        ? `border-${accentClass} bg-${accentClass}/10 scale-[1.01]`
                        : files.length > 0
                            ? `border-${accentClass}/60 bg-${accentClass}/5`
                            : `border-border hover:border-${accentClass}/40 hover:bg-${accentClass}/5`
                    }
        `}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    multiple={multiple}
                    className="sr-only"
                    onChange={(e) => addFiles(e.target.files)}
                />

                {files.length === 0 ? (
                    <>
                        <Upload className={`w-8 h-8 text-${accentClass} opacity-60 mx-auto mb-2`} />
                        <p className="font-body text-sm text-muted-foreground">
                            Drag & drop or{" "}
                            <span className={`text-${accentClass} font-semibold`}>browse</span>
                        </p>
                        {hint && (
                            <p className="font-body text-xs text-muted-foreground mt-1">{hint}</p>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className={`w-5 h-5 text-${accentClass} shrink-0`} />
                        <span className="font-body text-sm font-semibold text-foreground">
                            {files.length} file{files.length > 1 ? "s" : ""} ready
                        </span>
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <p className="font-body text-xs text-red-500">{error}</p>
            )}

            {/* File previews */}
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((f, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30"
                        >
                            {isImage(f) ? (
                                <img
                                    src={URL.createObjectURL(f)}
                                    alt={f.name}
                                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                                />
                            ) : (
                                <div className={`w-10 h-10 rounded-lg bg-${accentClass}/10 flex items-center justify-center shrink-0`}>
                                    <FileText className={`w-5 h-5 text-${accentClass}`} />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-body text-xs font-semibold text-foreground truncate">{f.name}</p>
                                <p className="font-body text-xs text-muted-foreground">
                                    {(f.size / 1024).toFixed(0)} KB
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); remove(i); }}
                                className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
