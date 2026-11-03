import { useState, useEffect, type FormEvent } from "react";
import { Pencil, Trash2, X, Image as ImageIcon } from "lucide-react";
import Button from "@/components/Button";
import Input from "@/components/Input";
import EditStageThumbnailsDialog from "./EditStageThumbnailsDialog";
import { updateStage, deleteStage } from "@/services/curriculum";
import type { Stage } from "@/interfaces/curriculum.interface";

interface EditStageDialogProps {
  stage: Stage;
  onUpdated: () => void;
  onDeleted?: () => void;
}

export default function EditStageDialog({ stage, onUpdated, onDeleted }: EditStageDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [title, setTitle] = useState(stage.title);
  const [description, setDescription] = useState(stage.description || "");
  const [stageNumber, setStageNumber] = useState(stage.stage_number);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState(false);

  useEffect(() => {
    setTitle(stage.title);
    setDescription(stage.description || "");
    setStageNumber(stage.stage_number);
  }, [stage]);

  const handleOpen = () => {
    setTitle(stage.title);
    setDescription(stage.description || "");
    setStageNumber(stage.stage_number);
    setError(null);
    setIsOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Stage title is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateStage(stage.id, {
        title: title.trim(),
        description: description.trim(),
        stage_number: Number(stageNumber) || 1,
      });
      setIsOpen(false);
      onUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to update stage.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteStage(stage.id);
      setIsDeleteModalOpen(false);
      setIsOpen(false);
      if (onDeleted) onDeleted();
      else onUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to delete stage.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        type="button"
        className="gap-1 px-3 py-1.5 text-xs text-gray-700 hover:text-(--primary) cursor-pointer"
        onClick={handleOpen}
        title="Edit Stage"
      >
        <Pencil className="size-3.5" />
        <span>Edit</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">Edit Stage</h3>
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
                  Stage Number
                </label>
                <Input
                  type="number"
                  min={1}
                  value={stageNumber}
                  onChange={(e) => setStageNumber(Number(e.target.value))}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Stage Title
                </label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Colors - Primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  className="w-full min-h-24 resize-none rounded-xl border border-gray-300 p-3 text-sm text-gray-800 outline-none focus:border-(--primary)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Instructions or signs included in this stage..."
                />
              </div>

              {/* Visual Aid Thumbnails Quick Action */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                    <ImageIcon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-950">Visual Aid Thumbnails</p>
                    <p className="text-[11px] text-amber-800 truncate">
                      Customize prompt illustrations shown in Lesson Proper
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsThumbnailsOpen(true)}
                  className="px-2.5 py-1 text-xs shrink-0 bg-white text-amber-800 border-amber-300 hover:bg-amber-100 cursor-pointer"
                >
                  Manage
                </Button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="size-4" />
                  <span>Delete Stage</span>
                </button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <h4 className="text-base font-bold text-gray-900">Delete Stage?</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Are you sure you want to delete <strong className="text-gray-900">{stage.title}</strong>? All baseline videos and demonstration rounds inside this stage will be removed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
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
                {loading ? "Deleting..." : "Yes, Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Visual Aid Thumbnails Dialog */}
      <EditStageThumbnailsDialog
        isOpen={isThumbnailsOpen}
        onClose={() => setIsThumbnailsOpen(false)}
        stageId={stage.id}
        stageTitle={stage.title}
        stageNumber={stageNumber}
        onUpdated={onUpdated}
      />
    </>
  );
}
