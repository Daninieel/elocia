import { useState, useRef, type FormEvent } from "react";
import { Pencil, Trash2, X, Loader2, ImagePlus } from "lucide-react";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { updateSign, deleteSign, uploadSignPhoto } from "@/services/curriculum";
import { resolveMediaUrl } from "@/services/mini-games";

interface StageSignItem {
  id: string;
  sign_id: number;
  sign_name: string;
  video_filename: string;
  video_url: string;
  photo_url?: string;
}

interface EditSignDialogProps {
  sign: StageSignItem;
  onUpdated: () => void;
}

export default function EditSignDialog({ sign, onUpdated }: EditSignDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [signName, setSignName] = useState(sign.sign_name);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSignName(sign.sign_name);
    setSelectedPhoto(null);
    setError(null);
    setIsOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!signName.trim()) {
      setError("Sign name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const targetId = sign.id || String(sign.sign_id);
      if (signName.trim() !== sign.sign_name) {
        await updateSign(targetId, {
          sign_name: signName.trim(),
        });
      }
      if (selectedPhoto) {
        await uploadSignPhoto(targetId, selectedPhoto);
      }
      setIsOpen(false);
      onUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to update sign.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteSign(sign.id || sign.sign_id);
      setIsDeleteModalOpen(false);
      setIsOpen(false);
      onUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to delete sign.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleOpen}
          className="p-1 rounded-md text-gray-400 hover:text-(--primary) hover:bg-white/80 transition-colors cursor-pointer"
          title="Edit Round / Sign"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDeleteModalOpen(true);
          }}
          className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          title="Delete Sign / Round"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-gray-100 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">Edit Round: {sign.sign_name}</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Sign Name
                </label>
                <Input
                  type="text"
                  value={signName}
                  onChange={(e) => setSignName(e.target.value)}
                  placeholder="e.g. Black"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Visual Aid Picture / Illustration
                  </label>
                  <span className="text-[10px] font-semibold text-(--primary) bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Lesson Proper
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mb-1.5">
                  Visual instruction prompt displayed to students instead of plain text.
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedPhoto(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-(--primary) rounded-xl p-3 text-center cursor-pointer transition bg-gray-50 hover:bg-gray-100/50 flex flex-col items-center justify-center gap-2"
                >
                  {selectedPhoto ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <img
                        src={URL.createObjectURL(selectedPhoto)}
                        alt="New visual aid preview"
                        className="h-20 max-w-full object-contain rounded-lg border border-gray-200 bg-white p-1 shadow-xs"
                      />
                      <p className="text-xs font-semibold text-gray-800">📸 {selectedPhoto.name}</p>
                      <p className="text-[11px] text-gray-500">Click to change picture</p>
                    </div>
                  ) : sign.photo_url ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <img
                        src={resolveMediaUrl(sign.photo_url)}
                        alt={sign.sign_name}
                        className="h-20 max-w-full object-contain rounded-lg border border-gray-200 bg-white p-1 shadow-xs"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.dataset.triedFallback && sign.photo_url) {
                            target.dataset.triedFallback = "true";
                            const filename = sign.photo_url.split("?")[0].split("/").pop();
                            target.src = `https://ovffqxjrokyuvlkmccup.supabase.co/storage/v1/object/public/elocia-media/thumbnails/${filename}`;
                          } else {
                            target.style.display = 'none';
                          }
                        }}
                      />
                      <p className="text-xs font-medium text-gray-700">Click to replace visual aid picture</p>
                      <p className="text-[11px] text-gray-400">PNG, JPG, or WebP</p>
                    </div>
                  ) : (
                    <div>
                      <ImagePlus className="size-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs font-medium text-gray-700">Click to upload visual aid picture</p>
                      <p className="text-[11px] text-gray-400">PNG, JPG, or WebP</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="size-3.5 animate-spin mr-1" />}
                  {loading ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4 text-left">
            <h4 className="text-base font-bold text-gray-900">Delete Sign?</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Are you sure you want to delete sign <strong className="text-gray-900">{sign.sign_name}</strong>? Its baseline model and practice round will be removed.
            </p>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setIsDeleteModalOpen(false);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading && <Loader2 className="size-3.5 animate-spin mr-1" />}
                {loading ? "Deleting..." : "Yes, Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
