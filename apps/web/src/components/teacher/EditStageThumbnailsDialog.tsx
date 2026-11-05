import { useState, useEffect, useRef, useCallback } from "react";
import { 
  X, 
  Image as ImageIcon, 
  Upload, 
  Check, 
  Loader2, 
  AlertCircle, 
  Sparkles,
  Info
} from "lucide-react";
import Button from "@/components/Button";
import { fetchStageById, uploadSignPhoto } from "@/services/curriculum";
import { resolveMediaUrl } from "@/services/mini-games";

export interface ThumbnailSignItem {
  id: string | number;
  sign_id?: number;
  sign_name: string;
  video_filename?: string;
  video_url?: string;
  photo_url?: string;
}

interface EditStageThumbnailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stageId: number | string;
  stageTitle?: string;
  stageNumber?: number;
  initialSigns?: ThumbnailSignItem[];
  focusSignId?: number | string;
  onUpdated?: () => void;
}

export default function EditStageThumbnailsDialog({
  isOpen,
  onClose,
  stageId,
  stageTitle,
  stageNumber,
  initialSigns,
  focusSignId,
  onUpdated,
}: EditStageThumbnailsDialogProps) {
  const [signs, setSigns] = useState<ThumbnailSignItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-sign staged files: { [signIdentifier]: File }
  const [stagedFiles, setStagedFiles] = useState<Record<string, File>>({});
  // Per-sign uploading status: { [signIdentifier]: boolean }
  const [uploadingSigns, setUploadingSigns] = useState<Record<string, boolean>>({});
  // Per-sign success status: { [signIdentifier]: boolean }
  const [successSigns, setSuccessSigns] = useState<Record<string, boolean>>({});
  // Global saving all status
  const [savingAll, setSavingAll] = useState(false);

  // Hidden file inputs mapped by sign identifier
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getSignKey = useCallback((sign: ThumbnailSignItem): string => {
    return String(sign.id || sign.sign_id || sign.sign_name);
  }, []);

  const loadSigns = useCallback(async () => {
    if (initialSigns && initialSigns.length > 0) {
      setSigns(initialSigns);
      return;
    }
    if (!stageId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await fetchStageById(stageId);
      if (data && Array.isArray(data.signs)) {
        setSigns(data.signs);
      } else {
        setSigns([]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load signs for this stage.");
    } finally {
      setLoading(false);
    }
  }, [stageId, initialSigns]);

  useEffect(() => {
    if (isOpen) {
      loadSigns();
      setStagedFiles({});
      setSuccessSigns({});
      setError(null);
    }
  }, [isOpen, loadSigns]);

  if (!isOpen) return null;

  const handleFileSelect = (signKey: string, file: File | null) => {
    if (!file) return;
    setStagedFiles((prev) => ({
      ...prev,
      [signKey]: file,
    }));
    // Clear any previous success indicator when a new file is chosen
    setSuccessSigns((prev) => {
      const copy = { ...prev };
      delete copy[signKey];
      return copy;
    });
  };

  const handleCancelStagedFile = (signKey: string) => {
    setStagedFiles((prev) => {
      const copy = { ...prev };
      delete copy[signKey];
      return copy;
    });
    if (fileInputRefs.current[signKey]) {
      fileInputRefs.current[signKey]!.value = "";
    }
  };

  const saveSingleSignThumbnail = async (sign: ThumbnailSignItem) => {
    const key = getSignKey(sign);
    const file = stagedFiles[key];
    if (!file) return;

    setUploadingSigns((prev) => ({ ...prev, [key]: true }));
    setError(null);

    try {
      const targetId = sign.id || sign.sign_id || sign.sign_name;
      const res = await uploadSignPhoto(targetId, file);

      // Update the sign photo_url in state with cache-busting timestamp
      setSigns((prevSigns) =>
        prevSigns.map((s) =>
          getSignKey(s) === key
            ? { ...s, photo_url: res.photo_url || `/thumbnails/${res.sign_id}.png?t=${Date.now()}` }
            : s
        )
      );

      // Clear staged file & mark success
      setStagedFiles((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      setSuccessSigns((prev) => ({ ...prev, [key]: true }));

      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err?.message || `Failed to update thumbnail for ${sign.sign_name}`);
    } finally {
      setUploadingSigns((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const handleSaveAllStaged = async () => {
    const keysToUpload = Object.keys(stagedFiles);
    if (keysToUpload.length === 0) return;

    setSavingAll(true);
    setError(null);

    try {
      for (const key of keysToUpload) {
        const sign = signs.find((s) => getSignKey(s) === key);
        if (sign && stagedFiles[key]) {
          const targetId = sign.id || sign.sign_id || sign.sign_name;
          const res = await uploadSignPhoto(targetId, stagedFiles[key]);
          setSigns((prevSigns) =>
            prevSigns.map((s) =>
              getSignKey(s) === key
                ? { ...s, photo_url: res.photo_url || `/thumbnails/${res.sign_id}.png?t=${Date.now()}` }
                : s
            )
          );
          setSuccessSigns((prev) => ({ ...prev, [key]: true }));
        }
      }
      setStagedFiles({});
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err?.message || "Failed to update some thumbnails.");
    } finally {
      setSavingAll(false);
    }
  };

  const stagedCount = Object.keys(stagedFiles).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !savingAll) onClose();
      }}
    >
      <div 
        className="w-full max-w-3xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6 text-left my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-50 text-(--primary) border border-amber-200">
                <ImageIcon className="size-5" />
              </span>
              <div>
                <h2 className="heading-3 text-gray-900">
                  Manage Visual Aid Thumbnails
                </h2>
                <p className="caption text-gray-500">
                  {stageNumber ? `Stage ${stageNumber}` : "Curriculum Stage"}
                  {stageTitle ? ` • ${stageTitle}` : ""}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={savingAll}
            className="text-gray-400 hover:text-gray-600 rounded-xl p-2 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Informative Guidance Banner */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-amber-900 text-xs">
          <Info className="size-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-semibold text-amber-950">
              Visual Aid Illustrations for Lesson Proper (Deaf & SPED Learners)
            </p>
            <p className="text-amber-800">
              Upload clear pictures or illustrations representing each sign (e.g. an apple, dog, or hand formation). These will be shown on the student desktop instead of the auto-captured teacher video frame. 
              <strong> Demonstration videos and evaluation landmarks will remain unchanged.</strong>
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 className="size-8 animate-spin text-(--primary)" />
            <p className="text-sm font-medium">Loading stage signs & rounds...</p>
          </div>
        ) : signs.length === 0 ? (
          <div className="p-8 rounded-2xl bg-gray-50 border border-dashed border-gray-300 text-center space-y-2">
            <ImageIcon className="size-10 text-gray-400 mx-auto" />
            <h3 className="font-bold text-gray-800">No Signs Found in this Stage</h3>
            <p className="text-xs text-gray-500">
              Add signs and demonstration videos to this stage first before customizing thumbnails.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {signs.map((sign, index) => {
              const key = getSignKey(sign);
              const stagedFile = stagedFiles[key];
              const isUploading = uploadingSigns[key] || savingAll;
              const isSuccess = successSigns[key];
              const isFocused = focusSignId && String(focusSignId) === key;

              const currentPhotoSrc = stagedFile
                ? URL.createObjectURL(stagedFile)
                : sign.photo_url
                ? resolveMediaUrl(sign.photo_url)
                : null;

              return (
                <div
                  key={key}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-center justify-between gap-4 ${
                    isFocused
                      ? "border-(--primary) bg-amber-50/30 ring-2 ring-amber-200"
                      : "border-gray-200 bg-gray-50/60 hover:bg-white hover:border-gray-300"
                  }`}
                >
                  {/* Left: Round Info & Current Thumbnail */}
                  <div className="flex items-center gap-4 w-full sm:w-auto min-w-0">
                    <span className="size-8 rounded-xl bg-gray-200/80 text-gray-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>

                    {/* Thumbnail preview with click-to-upload */}
                    <div
                      onClick={() => fileInputRefs.current[key]?.click()}
                      className="relative group size-16 rounded-xl overflow-hidden bg-white border border-gray-200 shadow-2xs cursor-pointer shrink-0 flex items-center justify-center hover:border-(--primary) transition"
                      title="Click to select replacement image"
                    >
                      {currentPhotoSrc ? (
                        <img
                          src={currentPhotoSrc}
                          alt={sign.sign_name}
                          className="h-full w-full object-contain p-1"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (!target.dataset.triedFallback && sign.photo_url) {
                              target.dataset.triedFallback = "true";
                              const filename = sign.photo_url.split("?")[0].split("/").pop();
                              target.src = `https://ovffqxjrokyuvlkmccup.supabase.co/storage/v1/object/public/elocia-media/thumbnails/${filename}`;
                            } else {
                              target.style.display = "none";
                            }
                          }}
                        />
                      ) : (
                        <div className="text-gray-400 flex flex-col items-center justify-center text-[10px]">
                          <ImageIcon className="size-5 mb-0.5" />
                          <span>None</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-[10px] font-semibold gap-0.5">
                        <Upload className="size-4" />
                        <span>Change</span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-gray-900 truncate">
                          {sign.sign_name}
                        </h4>
                        {stagedFile && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                            New Selected
                          </span>
                        )}
                        {isSuccess && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                            <Check className="size-3" /> Updated
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {stagedFile
                          ? `Ready: ${stagedFile.name} (${Math.round(stagedFile.size / 1024)} KB)`
                          : sign.photo_url
                          ? "Custom or default visual aid active"
                          : "Auto teacher frame fallback"}
                      </p>
                    </div>
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={(el) => {
                      fileInputRefs.current[key] = el;
                    }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(key, e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {stagedFile ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleCancelStagedFile(key)}
                          disabled={isUploading}
                          className="px-3 py-1.5 text-xs text-gray-600 cursor-pointer"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={() => saveSingleSignThumbnail(sign)}
                          disabled={isUploading}
                          className="px-3 py-1.5 text-xs gap-1.5 cursor-pointer"
                        >
                          {isUploading ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          <span>Save</span>
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRefs.current[key]?.click()}
                        disabled={isUploading}
                        className="px-3 py-1.5 text-xs gap-1.5 bg-white text-gray-700 hover:bg-gray-100 hover:text-(--primary) border-gray-300 cursor-pointer"
                      >
                        <Upload className="size-3.5" />
                        <span>Upload Image</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            {stagedCount > 0 ? (
              <span className="font-semibold text-amber-600">
                {stagedCount} sign thumbnail{stagedCount === 1 ? "" : "s"} waiting to save
              </span>
            ) : (
              <span>Supported formats: PNG, JPG, JPEG, WebP</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={savingAll}
              className="cursor-pointer"
            >
              Done
            </Button>
            {stagedCount > 1 && (
              <Button
                type="button"
                onClick={handleSaveAllStaged}
                disabled={savingAll}
                className="gap-2 cursor-pointer"
              >
                {savingAll ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                <span>Save All Changes ({stagedCount})</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
