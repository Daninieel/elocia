import { useState, useRef, type DragEvent } from "react";
import {
  UploadCloud,
  X,
  Loader2,
  Zap,
  CheckCircle2,
  AlertCircle,
  ImagePlus,
  ArrowUp,
  ArrowDown,
  Video,
  Plus,
} from "lucide-react";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { uploadStageBaseline } from "@/services/curriculum";

interface StagedSignItem {
  id: string;
  file: File | null;
  videoPreviewUrl: string;
  signName: string;
  photo: File | null;
  photoPreviewUrl: string;
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
  const [items, setItems] = useState<StagedSignItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanNameFromFile = (name: string): string => {
    const raw = name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const handleAddFiles = (fileList: FileList | File[]) => {
    const newItems: StagedSignItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["mp4", "webm", "mov", "mkv"].includes(ext || "")) continue;

      const videoPreviewUrl = URL.createObjectURL(file);
      newItems.push({
        id: `${file.name}-${Date.now()}-${i}`,
        file,
        videoPreviewUrl,
        signName: cleanNameFromFile(file.name),
        photo: null,
        photoPreviewUrl: "",
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

  const addBlankSign = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        file: null,
        videoPreviewUrl: "",
        signName: "",
        photo: null,
        photoPreviewUrl: "",
        status: "pending",
        progress: 0,
      },
    ]);
  };

  const updateItem = (id: string, updates: Partial<StagedSignItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const moveSign = (index: number, direction: "up" | "down") => {
    setItems((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  const removeItem = (id: string) => {
    if (isUploading) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSignVideoChange = (id: string, file: File) => {
    const videoPreviewUrl = URL.createObjectURL(file);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        return {
          ...it,
          file,
          videoPreviewUrl,
          signName: it.signName.trim() ? it.signName : cleanNameFromFile(file.name),
        };
      })
    );
  };

  const handleSignPhotoChange = (id: string, file: File) => {
    const photoPreviewUrl = URL.createObjectURL(file);
    updateItem(id, { photo: file, photoPreviewUrl });
  };

  const handleStartUpload = async () => {
    if (items.length === 0 || isUploading) return;

    // Validation
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      if (!it.signName.trim()) {
        setUploadError(`Please enter a Sign Name for Round #${idx + 1}.`);
        return;
      }
      if (!it.file) {
        setUploadError(`Please attach a video file for Round #${idx + 1} ("${it.signName}").`);
        return;
      }
    }

    setUploadError("");
    setIsUploading(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === "done") continue;

      setCurrentIndex(i);
      updateItem(item.id, { status: "uploading", progress: 0, error: undefined });

      try {
        await uploadStageBaseline(
          stageId,
          item.signName.trim(),
          item.file!,
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

    setIsUploading(false);
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
          <div className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Zap className="size-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Batch Upload Demonstration Signs
                  </h3>
                  <p className="text-xs text-gray-500">
                    Preview all demonstration rounds, review video playback, and auto-extract signs.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isUploading && setIsOpen(false)}
                disabled={isUploading}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 cursor-pointer disabled:opacity-50"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Error alert */}
            {uploadError && (
              <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-semibold flex items-center justify-between">
                <span>{uploadError}</span>
                <button
                  type="button"
                  onClick={() => setUploadError("")}
                  className="text-rose-500 hover:text-rose-700"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto space-y-5 py-4 pr-1">
              {/* Batch Drop Zone (Identical to See It, Sign It) */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-7 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                  isDragOver
                    ? "border-amber-500 bg-amber-50 scale-[0.99]"
                    : "border-amber-300 bg-amber-50/40 hover:bg-amber-50/70"
                }`}
              >
                <UploadCloud className="size-10 text-amber-500" />
                <span className="text-sm font-bold text-amber-900">
                  ⚡ Batch Upload Videos (Auto-Generates Rounds)
                </span>
                <span className="text-xs text-amber-700/80 max-w-md">
                  Drop multiple <b>.mp4</b> or <b>.webm</b> videos — target signs will be auto-named from filenames with full playable video previews!
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

              {/* Staged Signs Cards (See It, Sign It Layout) */}
              {items.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-800">
                      Rounds to Upload ({items.length})
                    </h4>
                    <span className="text-xs text-gray-500">
                      {completedCount} of {items.length} uploaded
                    </span>
                  </div>

                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <article
                        key={item.id}
                        className={`rounded-2xl border-2 p-5 transition relative ${
                          item.status === "uploading"
                            ? "border-amber-400 bg-amber-50/40 shadow-sm"
                            : item.status === "done"
                            ? "border-emerald-200 bg-emerald-50/30"
                            : item.status === "error"
                            ? "border-rose-200 bg-rose-50/40"
                            : "border-gray-200 bg-gray-50/60"
                        }`}
                      >
                        {/* Round Header Bar */}
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200/80">
                          <div className="flex items-center gap-2">
                            <span className="flex size-6 items-center justify-center rounded-full bg-amber-500 font-bold text-white text-xs">
                              {index + 1}
                            </span>
                            <span className="text-sm font-bold text-gray-800">
                              Round {index + 1}: {item.signName || "Untitled"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Move Up */}
                            <Button
                              type="button"
                              variant="outline"
                              className="px-2 py-1 text-xs"
                              disabled={index === 0 || isUploading}
                              onClick={() => moveSign(index, "up")}
                              title="Move sign up"
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>

                            {/* Move Down */}
                            <Button
                              type="button"
                              variant="outline"
                              className="px-2 py-1 text-xs"
                              disabled={index === items.length - 1 || isUploading}
                              onClick={() => moveSign(index, "down")}
                              title="Move sign down"
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>

                            {/* Status tag */}
                            {item.status === "uploading" && (
                              <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Loader2 className="size-3 animate-spin" />
                                {item.progress}%
                              </span>
                            )}
                            {item.status === "done" && (
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="size-3.5" />
                                Ready
                              </span>
                            )}

                            {/* Remove button */}
                            {!isUploading && (
                              <Button
                                type="button"
                                variant="destructive"
                                className="px-2 py-1 text-xs"
                                onClick={() => removeItem(item.id)}
                                title="Remove round"
                              >
                                <X className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Two-Column Grid: Visual Aid & Target Sign (Left) / Reference Video (Right) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left Column: Visual Aid & Sign Name */}
                          <div className="flex flex-col gap-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                  Visual Aid Picture
                                </span>
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  Lesson Proper Card
                                </span>
                              </div>
                              <label className="flex flex-col min-h-44 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-4 text-center transition-colors hover:border-amber-400 hover:bg-amber-50/30">
                                {item.photoPreviewUrl ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <img
                                      src={item.photoPreviewUrl}
                                      alt="Visual Aid"
                                      className="max-h-32 max-w-full rounded-xl object-contain shadow-xs"
                                    />
                                    <span className="text-[11px] font-semibold text-emerald-600">
                                      📸 {item.photo?.name} (Click to change)
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <ImagePlus className="size-8 text-amber-500" />
                                    <span className="text-xs font-semibold text-gray-700">
                                      Click to upload visual aid picture
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                      PNG or JPG (auto-captured snapshot if omitted)
                                    </span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  disabled={isUploading}
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleSignPhotoChange(item.id, e.target.files[0]);
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </div>

                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                                Target Sign Name
                              </label>
                              <Input
                                type="text"
                                placeholder="Enter the target sign name"
                                value={item.signName}
                                disabled={isUploading}
                                onChange={(e) => updateItem(item.id, { signName: e.target.value })}
                                required
                              />
                            </div>
                          </div>

                          {/* Right Column: Demonstration Video Player Preview */}
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                              Demonstration Video
                            </span>
                            <div className="flex flex-col min-h-44 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-3 text-center">
                              {item.videoPreviewUrl ? (
                                <div className="space-y-2 w-full flex flex-col items-center">
                                  <video
                                    key={item.videoPreviewUrl}
                                    src={item.videoPreviewUrl}
                                    controls
                                    playsInline
                                    className="max-h-40 w-full rounded-xl bg-black object-contain shadow-xs"
                                  />
                                  <div className="flex items-center justify-between w-full px-1 text-[11px] text-gray-500">
                                    <span className="font-semibold text-gray-700 truncate max-w-[200px]">
                                      🎬 {item.file?.name}
                                    </span>
                                    <span>
                                      {item.file
                                        ? `${(item.file.size / (1024 * 1024)).toFixed(1)} MB`
                                        : ""}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center justify-center gap-2 cursor-pointer w-full h-full py-6">
                                  <Video className="size-8 text-amber-500" />
                                  <span className="text-xs font-semibold text-gray-700">
                                    Click to select demonstration video
                                  </span>
                                  <span className="text-[10px] text-gray-400">
                                    MP4, WebM or MOV up to 100MB
                                  </span>
                                  <input
                                    type="file"
                                    accept="video/mp4,video/webm,video/quicktime,video/mkv"
                                    disabled={isUploading}
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleSignVideoChange(item.id, e.target.files[0]);
                                      }
                                    }}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar per round */}
                        {item.status === "uploading" && (
                          <div className="mt-3 space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-amber-700">
                              <span>
                                {item.progress < 100
                                  ? "Uploading video & cloud sync..."
                                  : "Extracting landmarks with MediaPipe..."}
                              </span>
                              <span>{item.progress}%</span>
                            </div>
                            <div className="w-full bg-amber-100 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-amber-500 h-full transition-all duration-150 rounded-full"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Error state */}
                        {item.status === "error" && item.error && (
                          <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                            <AlertCircle className="size-4 shrink-0" />
                            <span>{item.error}</span>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>

                  {/* Add Another Sign Button */}
                  {!isUploading && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addBlankSign}
                      className="w-full gap-2 py-3 border-2 border-dashed border-gray-300 hover:border-amber-400 hover:bg-amber-50/30 text-xs font-bold text-gray-700 cursor-pointer rounded-2xl"
                    >
                      <Plus className="size-4 text-amber-500" />
                      <span>Add Another Demonstration Round</span>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-medium">
                {items.length > 0
                  ? `${items.length} ${items.length === 1 ? "round" : "rounds"} staged`
                  : "No demonstration videos staged yet."}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isUploading}
                >
                  {allCompleted ? "Done" : "Cancel"}
                </Button>
                {items.length > 0 && !allCompleted && (
                  <Button
                    type="button"
                    onClick={handleStartUpload}
                    disabled={isUploading}
                    className="gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer"
                  >
                    {isUploading && <Loader2 className="size-4 animate-spin" />}
                    {isUploading
                      ? `Processing (${currentIndex + 1}/${items.length})...`
                      : `🚀 Upload & Save All (${items.length} Signs)`}
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
