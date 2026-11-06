import { useState, useRef, type FormEvent } from "react";
import { Upload, X, Loader2, Video, ImagePlus } from "lucide-react";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { uploadStageBaseline } from "@/services/curriculum";

interface AddSignDialogProps {
  stageId: number;
  gradeLevel?: number;
  onAdded: () => void;
}

export default function AddSignDialog({ stageId, gradeLevel = 1, onAdded }: AddSignDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [signName, setSignName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    setSignName("");
    setSelectedFile(null);
    setSelectedPhoto(null);
    setError(null);
    setIsOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!signName.trim()) {
        const rawName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
        const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        setSignName(cleanName);
      }
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedPhoto(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!signName.trim()) {
      setError("Please enter a sign name.");
      return;
    }
    if (!selectedFile) {
      setError("Please select a video file (.mp4, .webm, .mov).");
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setError(null);

    try {
      await uploadStageBaseline(
        stageId,
        signName.trim(),
        selectedFile,
        gradeLevel,
        `Demonstration video for ${signName.trim()}`,
        selectedPhoto,
        (percent) => setUploadProgress(percent)
      );
      setIsOpen(false);
      onAdded();
    } catch (err: any) {
      setError(err.message || "Failed to upload sign video.");
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <>
      <Button
        type="button"
        className="gap-1.5 px-3 py-1.5 text-xs cursor-pointer"
        onClick={handleOpen}
      >
        <Upload className="size-3.5" />
        <span>Add Sign Video</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Video className="size-5 text-(--primary)" />
                <h3 className="text-lg font-bold text-gray-900">Add Demonstration Sign</h3>
              </div>
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Sign Name
                </label>
                <Input
                  type="text"
                  value={signName}
                  onChange={(e) => setSignName(e.target.value)}
                  placeholder="e.g. Black, Brown, Hello"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Demonstration Video
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/mkv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-(--primary) rounded-xl p-4 text-center cursor-pointer transition bg-gray-50 hover:bg-gray-100/50 flex flex-col items-center justify-center gap-2"
                >
                  <Upload className="size-6 text-gray-400" />
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <video
                        src={URL.createObjectURL(selectedFile)}
                        controls
                        playsInline
                        className="max-h-40 w-full rounded-lg bg-black object-contain shadow-xs"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-800">🎬 {selectedFile.name}</p>
                        <p className="text-[11px] text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB (Click to replace)</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-gray-700">Click to upload video</p>
                      <p className="text-[11px] text-gray-400">MP4, WebM, or MOV format</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Visual Aid Picture / Illustration (Optional)
                  </label>
                  <span className="text-[10px] font-semibold text-(--primary) bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Lesson Proper Card
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mb-1.5">
                  Shown directly to students on the right-hand card in Lesson Proper instead of plain text.
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={handlePhotoChange}
                  className="hidden"
                />

                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-(--primary) rounded-xl p-4 text-center cursor-pointer transition bg-gray-50 hover:bg-gray-100/50 flex flex-col items-center justify-center gap-2"
                >
                  <ImagePlus className="size-6 text-gray-400" />
                  {selectedPhoto ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={URL.createObjectURL(selectedPhoto)}
                        alt="Visual Aid Preview"
                        className="h-24 max-w-full object-contain rounded-lg border border-gray-200 bg-white p-1 shadow-xs"
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-800">📸 {selectedPhoto.name}</p>
                        <p className="text-[11px] text-gray-500">{(selectedPhoto.size / 1024).toFixed(0)} KB (Click to change)</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-gray-700">Click to upload visual aid picture</p>
                      <p className="text-[11px] text-gray-400">PNG, JPG, or WebP (auto-captured snapshot if omitted)</p>
                    </div>
                  )}
                </div>
              </div>

              {loading && (
                <div className="space-y-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>
                      {uploadProgress < 100
                        ? `Uploading video file...`
                        : `Processing landmarks with MediaPipe...`}
                    </span>
                    <span className="text-(--primary) font-bold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-(--primary) h-full transition-all duration-150 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="gap-2">
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  {loading
                    ? uploadProgress < 100
                      ? `Uploading (${uploadProgress}%)...`
                      : "Extracting Landmarks..."
                    : "Upload & Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
