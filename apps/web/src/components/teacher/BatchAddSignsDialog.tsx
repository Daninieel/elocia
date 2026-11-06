import { useState, useRef } from "react";
import {
  UploadCloud,
  X,
  Loader2,
  Zap,
  CheckCircle2,
  ImagePlus,
  ArrowUp,
  ArrowDown,
  Copy,
  Flag,
  Upload,
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanNameFromFile = (name: string): string => {
    const raw = name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const handleBatchVideoDrop = (files: File[]) => {
    if (files.length === 0) return;
    const newItems: StagedSignItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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
      setItems((prev) => {
        // If there was only 1 empty item, replace it
        const hasOnlyEmptyFirst =
          prev.length === 1 && !prev[0].signName && !prev[0].videoPreviewUrl;
        const baseItems = hasOnlyEmptyFirst ? [] : prev;
        return [...baseItems, ...newItems];
      });
    }
  };

  const addRound = () => {
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

  const duplicateRound = (index: number) => {
    setItems((prev) => {
      const source = prev[index];
      const cloned: StagedSignItem = {
        ...source,
        id: `${source.signName}-copy-${Date.now()}`,
        status: "pending",
        progress: 0,
      };
      const updated = [...prev];
      updated.splice(index + 1, 0, cloned);
      return updated;
    });
  };

  const moveRound = (index: number, direction: "up" | "down") => {
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

  const deleteRound = (index: number) => {
    if (isUploading) return;
    setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateItem = (index: number, updates: Partial<StagedSignItem>) => {
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...updates } : item
      )
    );
  };

  const handleMediaFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    index: number,
    field: "objective_image_url" | "reference_video_url"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (field === "reference_video_url") {
      const videoPreviewUrl = URL.createObjectURL(file);
      const currentName = items[index]?.signName;
      updateItem(index, {
        file,
        videoPreviewUrl,
        signName: currentName?.trim() ? currentName : cleanNameFromFile(file.name),
      });
    } else {
      const photoPreviewUrl = URL.createObjectURL(file);
      updateItem(index, { photo: file, photoPreviewUrl });
    }
  };

  const handleStartUpload = async () => {
    if (items.length === 0 || isUploading) return;

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      if (!it.signName.trim()) {
        setUploadError(`Please enter a Target Sign name for Round ${idx + 1}.`);
        return;
      }
      if (!it.file) {
        setUploadError(`Please upload a video for Round ${idx + 1} ("${it.signName}").`);
        return;
      }
    }

    setUploadError("");
    setIsUploading(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === "done") continue;

      setCurrentIndex(i);
      setUploadProgress(0);
      updateItem(i, { status: "uploading", progress: 0, error: undefined });

      try {
        await uploadStageBaseline(
          stageId,
          item.signName.trim(),
          item.file!,
          gradeLevel,
          `Demonstration video for ${item.signName.trim()}`,
          item.photo || undefined,
          (percent) => {
            setUploadProgress(percent);
            updateItem(i, { progress: percent });
          }
        );
        updateItem(i, { status: "done", progress: 100 });
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to upload sign video";
        updateItem(i, { status: "error", error: errorMsg });
      }
    }

    setIsUploading(false);
    setCurrentIndex(-1);
    setUploadProgress(0);
    onComplete();
  };

  const handleOpen = () => {
    if (items.length === 0) {
      addRound();
    }
    setIsOpen(true);
  };

  const allCompleted = items.length > 0 && items.every((it) => it.status === "done");
  const completedCount = items.filter((it) => it.status === "done").length;

  return (
    <>
      <Button
        type="button"
        className="gap-1.5 px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs font-semibold"
        onClick={handleOpen}
      >
        <Zap className="size-3.5 fill-current" />
        <span>Batch Upload Signs</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-5xl rounded-4xl bg-(--bg) p-6 sm:p-8 shadow-2xl border border-(--border) flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-(--border) pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-(--primary-light) text-(--primary) flex items-center justify-center">
                  <Zap className="size-5 fill-current" />
                </div>
                <div>
                  <h3 className="heading-3 text-(--black)">
                    Batch Upload Demonstration Signs
                  </h3>
                  <p className="caption text-(--ghost)">
                    Drop demonstration videos, review round previews, and auto-generate sign rounds.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isUploading && setIsOpen(false)}
                disabled={isUploading}
                className="text-(--ghost) hover:text-(--black) rounded-xl p-1.5 cursor-pointer disabled:opacity-50"
              >
                <X className="size-6" />
              </button>
            </div>

            {/* Error Banner */}
            {uploadError && (
              <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-xl text-sm flex items-center justify-between">
                <span>{uploadError}</span>
                <button
                  type="button"
                  onClick={() => setUploadError("")}
                  className="font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Scrollable Container with Exactly the Same See It Sign It TSX & CSS */}
            <div className="flex-1 overflow-y-auto space-y-6 py-6 pr-1">
              {/* Batch Video Dropzone (Identical to See It, Sign It) */}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--primary) bg-(--primary-light)/40 p-6 text-center transition-colors hover:bg-(--primary-light)">
                <UploadCloud className="size-8 text-(--primary)" />
                <span className="paragraph-2 font-semibold text-(--primary)">
                  {isUploading
                    ? `⚡ Processing sign ${currentIndex + 1} of ${items.length} (${uploadProgress}%)...`
                    : "⚡ Batch Upload Videos (Auto-Generates Rounds)"}
                </span>
                <span className="caption text-(--ghost)">
                  Drop multiple .mp4 / .webm videos — target signs will be auto-named from filenames!
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    handleBatchVideoDrop(files);
                    e.target.value = "";
                  }}
                />
              </label>

              {/* Rounds List (Identical Card Structure to See It, Sign It) */}
              {items.map((item, index) => (
                <article
                  key={item.id}
                  className="flex flex-col gap-6 p-6 bg-(--white) rounded-4xl shadow-lg/5 border border-(--border)"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-(--primary) text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <Flag className="size-5 text-(--black)" />
                      <h1 className="heading-3">Round {index + 1}</h1>
                      {item.status === "done" && (
                        <span className="ml-2 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="size-3.5" />
                          Ready
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Move Up */}
                      <Button
                        type="button"
                        variant="outline"
                        className="px-2.5 py-1 text-xs"
                        disabled={index === 0 || isUploading}
                        onClick={() => moveRound(index, "up")}
                        title="Move round up"
                      >
                        <ArrowUp className="size-4" />
                      </Button>

                      {/* Move Down */}
                      <Button
                        type="button"
                        variant="outline"
                        className="px-2.5 py-1 text-xs"
                        disabled={index === items.length - 1 || isUploading}
                        onClick={() => moveRound(index, "down")}
                        title="Move round down"
                      >
                        <ArrowDown className="size-4" />
                      </Button>

                      {/* Duplicate Round */}
                      <Button
                        type="button"
                        variant="outline"
                        className="px-2.5 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        disabled={isUploading}
                        onClick={() => duplicateRound(index)}
                        title="Duplicate round"
                      >
                        <Copy className="size-4" />
                      </Button>

                      {/* Remove */}
                      {items.length > 1 && !isUploading && (
                        <Button
                          type="button"
                          variant="destructive"
                          className="px-2.5 py-1 text-xs"
                          onClick={() => deleteRound(index)}
                          title="Delete round"
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Left Column: Objective Image (Visual Aid) + Target Sign */}
                    <div className="flex flex-col gap-4">
                      <div>
                        <span className="paragraph-2 font-medium text-(--black) block mb-2">
                          Objective Image
                        </span>
                        <label className="flex flex-col min-h-56 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-6 text-center transition-colors hover:border-(--primary) hover:bg-(--primary-light) relative overflow-hidden">
                          {item.photoPreviewUrl ? (
                            <img
                              src={item.photoPreviewUrl}
                              alt="Uploaded objective"
                              className="max-h-40 max-w-full rounded-xl object-contain"
                            />
                          ) : (
                            <>
                              <ImagePlus className="size-10 text-(--primary)" />
                              <span className="paragraph-2 font-semibold text-(--black)">
                                Click to upload an image
                              </span>
                              <span className="caption text-(--ghost)">
                                PNG or JPG up to 10MB
                              </span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) =>
                              handleMediaFileChange(event, index, "objective_image_url")
                            }
                            disabled={isUploading}
                            className="sr-only"
                          />
                        </label>
                      </div>

                      <div>
                        <label htmlFor={`target-sign-${index}`} className="paragraph-2 font-medium text-(--black) block mb-2">
                          Target Sign
                        </label>
                        <Input
                          id={`target-sign-${index}`}
                          type="text"
                          placeholder="Enter the target sign"
                          value={item.signName}
                          disabled={isUploading}
                          onChange={(event) =>
                            updateItem(index, { signName: event.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    {/* Right Column: Reference Video (Demonstration Video) */}
                    <div>
                      <div>
                        <span className="paragraph-2 font-medium text-(--black) block mb-2">
                          Reference Video
                        </span>
                        <label className="flex flex-col min-h-56 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-6 text-center transition-colors hover:border-(--primary) hover:bg-(--primary-light) relative overflow-hidden">
                          {item.videoPreviewUrl ? (
                            <div className="relative flex flex-col items-center w-full">
                              <video
                                key={item.videoPreviewUrl}
                                src={item.videoPreviewUrl}
                                controls
                                playsInline
                                className="max-h-40 max-w-full rounded-xl bg-black"
                              />
                              <div className="flex items-center justify-between w-full px-2 mt-2 text-[11px] text-(--ghost)">
                                <span className="font-semibold truncate max-w-[200px]">
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
                            <>
                              <Upload className="size-10 text-(--primary)" />
                              <span className="paragraph-2 font-semibold text-(--black)">
                                Click to upload a video
                              </span>
                              <span className="caption text-(--ghost)">
                                MP4, WebM, or MOV up to 100MB
                              </span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                            onChange={(event) =>
                              handleMediaFileChange(event, index, "reference_video_url")
                            }
                            disabled={isUploading}
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Upload Progress Bar if this item is currently uploading */}
                  {item.status === "uploading" && (
                    <div className="space-y-1 bg-amber-50 p-3 rounded-2xl border border-amber-200">
                      <div className="flex justify-between text-xs font-semibold text-(--primary)">
                        <span>
                          {item.progress < 100
                            ? "Uploading video & cloud sync..."
                            : "Extracting MediaPipe landmark baseline..."}
                        </span>
                        <span>{item.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-(--primary) h-full transition-all duration-150 rounded-full"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error display */}
                  {item.status === "error" && item.error && (
                    <div className="p-3 bg-red-100 text-red-700 rounded-xl text-xs font-semibold">
                      {item.error}
                    </div>
                  )}
                </article>
              ))}

              {/* Add Round Button (Identical to See It, Sign It) */}
              {!isUploading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRound}
                  className="w-full py-4 rounded-3xl border-2 border-dashed border-(--border) hover:border-(--primary) hover:bg-(--primary-light) text-sm font-bold text-(--primary) gap-2 cursor-pointer transition-colors"
                >
                  <Plus className="size-4" />
                  <span>Add Round</span>
                </Button>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-(--border) pt-4">
              <span className="caption text-(--ghost)">
                {items.length} {items.length === 1 ? "round" : "rounds"} ({completedCount} uploaded)
              </span>
              <div className="flex items-center gap-3">
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
                    className="gap-2 cursor-pointer font-bold"
                  >
                    {isUploading && <Loader2 className="size-4 animate-spin" />}
                    {isUploading
                      ? `Processing (${currentIndex + 1}/${items.length})...`
                      : `Upload & Save All (${items.length} Rounds)`}
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
