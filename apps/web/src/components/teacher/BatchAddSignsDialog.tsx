import { useState, useRef, type DragEvent } from "react";
import { UploadCloud, X, Loader2, Zap, CheckCircle2, AlertCircle, ImagePlus, Trash2 } from "lucide-react";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { uploadStageBaseline } from "@/services/curriculum";

interface BatchItem {
  id: string;
  file: File;
  signName: string;
  photo?: File | null;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

interface BatchAddSignsDialogProps {
  stageId: number;
  gradeLevel?: number;
  onComplete: () => void;
}

export default function BatchAddSignsDialog({
  stageId,
  gradeLevel = 1,
  onComplete,
}: BatchAddSignsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanNameFromFile = (name: string): string => {
    const raw = name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const handleAddFiles = (fileList: FileList | File[]) => {
    const newItems: BatchItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["mp4", "webm", "mov", "mkv"].includes(ext || "")) continue;

      newItems.push({
        id: `${file.name}-${Date.now()}-${i}`,
        file,
        signName: cleanNameFromFile(file.name),
        status: "pending",
        progress: 0,
      });
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const updateItem = (id: string, updates: Partial<BatchItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeItem = (id: string) => {
    if (isProcessing) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleStartBatchUpload = async () => {
    if (items.length === 0 || isProcessing) return;

    // Validate that all items have a signName
    const emptyIndex = items.findIndex((it) => !it.signName.trim());
    if (emptyIndex !== -1) {
      alert(`Please enter a sign name for file #${emptyIndex + 1}: ${items[emptyIndex].file.name}`);
      return;
    }

    setIsProcessing(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === "done") continue;

      setCurrentIndex(i);
      updateItem(item.id, { status: "uploading", progress: 0, error: undefined });

      try {
        await uploadStageBaseline(
          stageId,
          item.signName.trim(),
          item.file,
          gradeLevel,
          `Demonstration video for ${item.signName.trim()}`,
          item.photo || undefined,
          (percent) => {
            updateItem(item.id, { progress: percent });
          }
        );
        updateItem(item.id, { status: "done", progress: 100 });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Failed to upload sign video";
        updateItem(item.id, { status: "error", error: errorMsg });
      }
    }

    setIsProcessing(false);
    setCurrentIndex(-1);
    onComplete();
  };

  const allCompleted = items.length > 0 && items.every((it) => it.status === "done");
  const completedCount = items.filter((it) => it.status === "done").length;

  return (
    <>
      <Button
        type="button"
        className="gap-1.5 px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs font-semibold"
        onClick={() => setIsOpen(true)}
      >
        <Zap className="size-3.5 fill-current" />
        <span>Batch Upload Signs</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Zap className="size-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Batch Upload Demonstration Signs</h3>
                  <p className="text-xs text-gray-500">
                    Auto-names signs from video filenames and processes MediaPipe landmarks sequentially.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isProcessing && setIsOpen(false)}
                disabled={isProcessing}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 cursor-pointer disabled:opacity-50"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                  isDragOver
                    ? "border-amber-500 bg-amber-50 scale-[0.99]"
                    : "border-amber-300 bg-amber-50/40 hover:bg-amber-50/70"
                }`}
              >
                <UploadCloud className="size-10 text-amber-500" />
                <span className="text-sm font-bold text-amber-900">
                  ⚡ Drop Multiple Videos Here (.mp4, .webm, .mov)
                </span>
                <span className="text-xs text-amber-700/80">
                  Target signs will be auto-named from the files (e.g. <code>1.mp4</code> → <b>1</b>, <code>Apple.mp4</code> → <b>Apple</b>)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="video/mp4,video/webm,video/quicktime,video/mkv"
                  onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* Items List */}
              {items.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                    <span>Staged Signs ({items.length})</span>
                    {isProcessing && (
                      <span className="text-amber-600 font-bold">
                        Uploading item {currentIndex + 1} of {items.length}...
                      </span>
                    )}
                    {allCompleted && (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> All {items.length} signs uploaded!
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-3 flex flex-col gap-2 transition ${
                          item.status === "uploading"
                            ? "border-amber-400 bg-amber-50/60 shadow-xs"
                            : item.status === "done"
                            ? "border-emerald-200 bg-emerald-50/40"
                            : item.status === "error"
                            ? "border-rose-200 bg-rose-50/50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Mini Video Preview */}
                          <div className="relative size-12 shrink-0 rounded-lg overflow-hidden bg-black flex items-center justify-center shadow-xs">
                            <video
                              src={URL.createObjectURL(item.file)}
                              className="size-full object-contain pointer-events-none"
                            />
                            <span className="absolute bottom-0 right-0 bg-black/70 text-[9px] text-white px-1 font-mono">
                              {(item.file.size / (1024 * 1024)).toFixed(1)}M
                            </span>
                          </div>

                          {/* Sign Name Input */}
                          <div className="flex-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-0.5">
                              Sign #{idx + 1} Name
                            </label>
                            <Input
                              type="text"
                              value={item.signName}
                              onChange={(e) => updateItem(item.id, { signName: e.target.value })}
                              placeholder="e.g. Hello, Ball, 1"
                              disabled={isProcessing}
                              className="h-8 text-xs font-semibold"
                            />
                          </div>

                          {/* Optional Visual Aid Image */}
                          <div className="shrink-0 flex flex-col items-center">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-0.5">
                              Visual Aid
                            </label>
                            <label className="cursor-pointer">
                              {item.photo ? (
                                <img
                                  src={URL.createObjectURL(item.photo)}
                                  alt="Photo"
                                  className="size-8 object-contain rounded-lg border border-amber-300 bg-white shadow-xs"
                                  title="Change visual aid picture"
                                />
                              ) : (
                                <div
                                  className="size-8 rounded-lg border border-dashed border-gray-300 hover:border-amber-400 bg-white flex items-center justify-center text-gray-400 hover:text-amber-600 transition"
                                  title="Add visual aid picture (optional)"
                                >
                                  <ImagePlus className="size-4" />
                                </div>
                              )}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                disabled={isProcessing}
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    updateItem(item.id, { photo: e.target.files[0] });
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {/* Status / Remove Action */}
                          <div className="shrink-0 flex items-center gap-1.5 pl-2">
                            {item.status === "pending" && (
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                disabled={isProcessing}
                                className="text-gray-400 hover:text-rose-600 p-1 rounded-lg cursor-pointer transition"
                                title="Remove sign"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                            {item.status === "uploading" && (
                              <div className="flex items-center gap-1 text-xs text-amber-600 font-bold">
                                <Loader2 className="size-4 animate-spin" />
                                <span>{item.progress}%</span>
                              </div>
                            )}
                            {item.status === "done" && (
                              <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold">
                                <CheckCircle2 className="size-4" />
                                Done
                              </span>
                            )}
                            {item.status === "error" && (
                              <span className="text-rose-600 flex items-center gap-1 text-xs font-bold" title={item.error}>
                                <AlertCircle className="size-4" />
                                Error
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress bar per item when uploading */}
                        {item.status === "uploading" && (
                          <div className="w-full bg-amber-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-amber-500 h-full transition-all duration-150"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        )}

                        {/* Error detail */}
                        {item.status === "error" && item.error && (
                          <p className="text-[11px] text-rose-600 bg-rose-50 px-2 py-1 rounded">
                            {item.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-medium">
                {items.length > 0
                  ? `${completedCount} of ${items.length} signs uploaded`
                  : "No videos staged yet."}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isProcessing}
                >
                  {allCompleted ? "Close" : "Cancel"}
                </Button>
                {items.length > 0 && !allCompleted && (
                  <Button
                    type="button"
                    onClick={handleStartBatchUpload}
                    disabled={isProcessing}
                    className="gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold"
                  >
                    {isProcessing && <Loader2 className="size-4 animate-spin" />}
                    {isProcessing
                      ? `Uploading (${currentIndex + 1}/${items.length})...`
                      : `Upload All (${items.length} Signs)`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
