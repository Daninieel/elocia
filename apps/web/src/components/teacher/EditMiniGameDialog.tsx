import { useState, useEffect } from "react";
import {
  X,
  ImagePlus,
  Plus,
  Trash2,
  Loader2,
  Video,
  Save,
} from "lucide-react";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Dropdown from "@/components/Dropdown";
import Separator from "@/components/Separator";
import type {
  MiniGameConfig,
  SeeItSignItItem,
  PuzzleSignItem,
  MagicFingersItem,
} from "@/interfaces/mini-game.interface";
import {
  updateMiniGame,
  uploadMiniGameMedia,
  resolveMediaUrl,
  type UpdateMiniGamePayload,
} from "@/services/mini-games";

interface EditMiniGameDialogProps {
  isOpen: boolean;
  miniGame: MiniGameConfig;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditMiniGameDialog({
  isOpen,
  miniGame,
  onClose,
  onUpdated,
}: EditMiniGameDialogProps) {
  const [title, setTitle] = useState(miniGame.title || "");
  const [description, setDescription] = useState(miniGame.description || "");
  const [difficulty, setDifficulty] = useState(miniGame.difficulty || 1);

  // Round items for each game type
  const [sisiItems, setSisiItems] = useState<SeeItSignItItem[]>([]);
  const [puzzleItems, setPuzzleItems] = useState<PuzzleSignItem[]>([]);
  const [magicItems, setMagicItems] = useState<MagicFingersItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    setTitle(miniGame.title || "");
    setDescription(miniGame.description || "");
    setDifficulty(miniGame.difficulty || 1);

    if (miniGame.game_type === "see_it_sign_it") {
      setSisiItems(
        miniGame.see_it_sign_it_items && miniGame.see_it_sign_it_items.length > 0
          ? [...miniGame.see_it_sign_it_items]
          : [
              {
                objective_image_url: "",
                objective_answer: "",
                reference_video_url: "",
                index_order: 0,
              },
            ],
      );
    } else if (miniGame.game_type === "puzzle_sign") {
      setPuzzleItems(
        miniGame.puzzle_sign_items && miniGame.puzzle_sign_items.length > 0
          ? [...miniGame.puzzle_sign_items]
          : [
              {
                word_one: "",
                word_two: "",
                hidden_word: "",
                word_form: "",
                word_one_image_url: "",
                word_two_image_url: "",
                word_form_image_url: "",
                reference_video_url: "",
                index_order: 0,
              },
            ],
      );
    } else if (miniGame.game_type === "magic_fingers") {
      setMagicItems(
        miniGame.magic_fingers_items && miniGame.magic_fingers_items.length > 0
          ? [...miniGame.magic_fingers_items]
          : [
              {
                word: "",
                hidden_positions: [],
                objective_image_url: "",
                reference_video_url: "",
                reference_video_url_2: "",
                index_order: 0,
              },
            ],
      );
    }
  }, [miniGame]);

  if (!isOpen) return null;

  // File upload handler for replacement
  const handleFileUpload = async (
    file: File,
    onSuccess: (uploadedUrl: string) => void,
    fieldKey: string,
  ) => {
    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    onSuccess(localUrl);

    setUploadingField(fieldKey);
    setUploadProgress(0);
    setError(null);
    try {
      const res = await uploadMiniGameMedia(file, (percent) => setUploadProgress(percent));
      onSuccess(res.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploadingField(null);
      setUploadProgress(0);
    }
  };

  // Save handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Activity title is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: UpdateMiniGamePayload = {
      title: title.trim(),
      description: description.trim(),
      difficulty: Number(difficulty),
    };

    if (miniGame.game_type === "see_it_sign_it") {
      if (sisiItems.some((item) => !item.objective_answer.trim())) {
        setError("Please enter a target sign for all rounds.");
        setSaving(false);
        return;
      }
      payload.see_it_sign_it_items = sisiItems.map((item, idx) => ({
        ...item,
        objective_answer: item.objective_answer.trim(),
        index_order: idx,
      }));
    } else if (miniGame.game_type === "puzzle_sign") {
      if (
        puzzleItems.some(
          (item) =>
            !item.word_one.trim() ||
            !item.word_two.trim() ||
            !item.hidden_word.trim() ||
            !item.word_form.trim(),
        )
      ) {
        setError("Please fill in all word fields for each puzzle round.");
        setSaving(false);
        return;
      }
      payload.puzzle_sign_items = puzzleItems.map((item, idx) => ({
        ...item,
        word_one: item.word_one.trim(),
        word_two: item.word_two.trim(),
        hidden_word: item.hidden_word.trim(),
        word_form: item.word_form.trim(),
        index_order: idx,
      }));
    } else if (miniGame.game_type === "magic_fingers") {
      if (magicItems.some((item) => !item.word.trim())) {
        setError("Please enter a target word for all Magic Fingers rounds.");
        setSaving(false);
        return;
      }
      payload.magic_fingers_items = magicItems.map((item, idx) => ({
        ...item,
        word: item.word.trim(),
        hidden_positions: item.hidden_positions || [],
        index_order: idx,
      }));
    }

    try {
      await updateMiniGame(miniGame.id, payload);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update mini-game");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-hidden animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gray-50/50">
          <div>
            <h2 className="heading-3 text-gray-900">Edit Mini Game Activity</h2>
            <p className="caption text-gray-500">
              Update activity details, round words, and replace reference media.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-xl p-2 cursor-pointer transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Content Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4 rounded-2xl bg-gray-50/80 p-5 border border-gray-200/60">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
              Activity Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Activity Title
                </label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Colors Practice"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Difficulty
                </label>
                <Dropdown
                  value={String(difficulty)}
                  onChange={(val) => setDifficulty(Number(val))}
                  options={[
                    { label: "Easy", value: "1" },
                    { label: "Medium", value: "2" },
                    { label: "Hard", value: "3" },
                  ]}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a brief description..."
                rows={2}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 outline-none focus:border-(--primary)"
              />
            </div>
          </div>

          <Separator />

          {/* Rounds Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                Rounds & Media Content
              </h3>
              <span className="caption text-gray-500 font-medium">
                {miniGame.game_type === "see_it_sign_it"
                  ? `${sisiItems.length} Rounds`
                  : miniGame.game_type === "puzzle_sign"
                    ? `${puzzleItems.length} Rounds`
                    : `${magicItems.length} Rounds`}
              </span>
            </div>

            {/* 1. SEE IT SIGN IT ITEMS */}
            {miniGame.game_type === "see_it_sign_it" && (
              <div className="space-y-4">
                {sisiItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-(--primary) text-xs font-bold text-white">
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-gray-900">
                          Round {idx + 1}
                        </h4>
                      </div>
                      {sisiItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSisiItems(sisiItems.filter((_, i) => i !== idx))
                          }
                          className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Delete round"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Target Sign */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Target Sign / Word
                        </label>
                        <Input
                          type="text"
                          value={item.objective_answer}
                          onChange={(e) => {
                            const updated = [...sisiItems];
                            updated[idx].objective_answer = e.target.value;
                            setSisiItems(updated);
                          }}
                          placeholder="e.g. Apple"
                          required
                        />
                      </div>

                      {/* Objective Image */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Objective Image
                        </label>
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white p-3 text-center">
                          {item.objective_image_url ? (
                            <img
                              src={resolveMediaUrl(item.objective_image_url)}
                              alt="Objective"
                              className="h-20 w-auto rounded-lg object-contain"
                            />
                          ) : (
                            <ImagePlus className="size-8 text-gray-400 my-2" />
                          )}
                          <label className="cursor-pointer text-xs font-semibold text-(--primary) hover:underline">
                            {uploadingField === `sisi_img_${idx}`
                              ? `Uploading (${uploadProgress}%)...`
                              : item.objective_image_url
                                ? "Replace Image"
                                : "Upload Image"}
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              disabled={uploadingField !== null}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  handleFileUpload(
                                    f,
                                    (url) => {
                                      const updated = [...sisiItems];
                                      updated[idx].objective_image_url = url;
                                      setSisiItems(updated);
                                    },
                                    `sisi_img_${idx}`,
                                  );
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Reference Video */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Reference Video
                        </label>
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white p-3 text-center">
                          {item.reference_video_url ? (
                            <video
                              src={resolveMediaUrl(item.reference_video_url)}
                              className="h-20 w-auto rounded-lg bg-black"
                              controls
                            />
                          ) : (
                            <Video className="size-8 text-gray-400 my-2" />
                          )}
                          <label className="cursor-pointer text-xs font-semibold text-(--primary) hover:underline">
                            {uploadingField === `sisi_vid_${idx}`
                              ? `Uploading (${uploadProgress}%)...`
                              : item.reference_video_url
                                ? "Replace Video"
                                : "Upload Video"}
                            <input
                              type="file"
                              accept="video/*"
                              className="sr-only"
                              disabled={uploadingField !== null}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  handleFileUpload(
                                    f,
                                    (url) => {
                                      const updated = [...sisiItems];
                                      updated[idx].reference_video_url = url;
                                      setSisiItems(updated);
                                    },
                                    `sisi_vid_${idx}`,
                                  );
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setSisiItems([
                      ...sisiItems,
                      {
                        objective_image_url: "",
                        objective_answer: "",
                        reference_video_url: "",
                        index_order: sisiItems.length,
                      },
                    ])
                  }
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-sm font-semibold text-(--primary) hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <Plus className="size-4" /> Add Round
                </button>
              </div>
            )}

            {/* 2. PUZZLE SIGN ITEMS */}
            {miniGame.game_type === "puzzle_sign" && (
              <div className="space-y-4">
                {puzzleItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-gray-900">
                          Puzzle Round {idx + 1}
                        </h4>
                      </div>
                      {puzzleItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPuzzleItems(
                              puzzleItems.filter((_, i) => i !== idx),
                            )
                          }
                          className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Word One
                        </label>
                        <Input
                          type="text"
                          value={item.word_one}
                          onChange={(e) => {
                            const updated = [...puzzleItems];
                            updated[idx].word_one = e.target.value;
                            setPuzzleItems(updated);
                          }}
                          placeholder="e.g. Butter"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Word Two
                        </label>
                        <Input
                          type="text"
                          value={item.word_two}
                          onChange={(e) => {
                            const updated = [...puzzleItems];
                            updated[idx].word_two = e.target.value;
                            setPuzzleItems(updated);
                          }}
                          placeholder="e.g. Fly"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Hidden Word
                        </label>
                        <Input
                          type="text"
                          value={item.hidden_word}
                          onChange={(e) => {
                            const updated = [...puzzleItems];
                            updated[idx].hidden_word = e.target.value;
                            setPuzzleItems(updated);
                          }}
                          placeholder="e.g. Fly"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Formed Compound
                        </label>
                        <Input
                          type="text"
                          value={item.word_form}
                          onChange={(e) => {
                            const updated = [...puzzleItems];
                            updated[idx].word_form = e.target.value;
                            setPuzzleItems(updated);
                          }}
                          placeholder="e.g. Butterfly"
                        />
                      </div>
                    </div>

                    {/* Media row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Compound Image
                        </label>
                        <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-3">
                          {item.word_form_image_url ? (
                            <img
                              src={resolveMediaUrl(item.word_form_image_url)}
                              alt="Form"
                              className="h-16 w-16 rounded-lg object-contain bg-gray-50"
                            />
                          ) : (
                            <ImagePlus className="size-8 text-gray-400" />
                          )}
                          <label className="cursor-pointer text-xs font-semibold text-(--primary) hover:underline">
                            {uploadingField === `puz_img_${idx}`
                              ? `Uploading (${uploadProgress}%)...`
                              : item.word_form_image_url
                                ? "Replace Image"
                                : "Upload Image"}
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              disabled={uploadingField !== null}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  handleFileUpload(
                                    f,
                                    (url) => {
                                      const updated = [...puzzleItems];
                                      updated[idx].word_form_image_url = url;
                                      setPuzzleItems(updated);
                                    },
                                    `puz_img_${idx}`,
                                  );
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Reference Video
                        </label>
                        <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-3">
                          {item.reference_video_url ? (
                            <video
                              src={resolveMediaUrl(item.reference_video_url)}
                              className="h-16 w-24 rounded-lg bg-black object-cover"
                              controls
                            />
                          ) : (
                            <Video className="size-8 text-gray-400" />
                          )}
                          <label className="cursor-pointer text-xs font-semibold text-(--primary) hover:underline">
                            {uploadingField === `puz_vid_${idx}`
                              ? `Uploading (${uploadProgress}%)...`
                              : item.reference_video_url
                                ? "Replace Video"
                                : "Upload Video"}
                            <input
                              type="file"
                              accept="video/*"
                              className="sr-only"
                              disabled={uploadingField !== null}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  handleFileUpload(
                                    f,
                                    (url) => {
                                      const updated = [...puzzleItems];
                                      updated[idx].reference_video_url = url;
                                      setPuzzleItems(updated);
                                    },
                                    `puz_vid_${idx}`,
                                  );
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setPuzzleItems([
                      ...puzzleItems,
                      {
                        word_one: "",
                        word_two: "",
                        hidden_word: "",
                        word_form: "",
                        word_one_image_url: "",
                        word_two_image_url: "",
                        word_form_image_url: "",
                        reference_video_url: "",
                        index_order: puzzleItems.length,
                      },
                    ])
                  }
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-sm font-semibold text-emerald-700 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <Plus className="size-4" /> Add Puzzle Round
                </button>
              </div>
            )}

            {/* 3. MAGIC FINGERS ITEMS */}
            {miniGame.game_type === "magic_fingers" && (
              <div className="space-y-4">
                {magicItems.map((item, idx) => {
                  const letters = (item.word || "").toUpperCase().split("");
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm font-bold text-gray-900">
                            Magic Fingers Round {idx + 1}
                          </h4>
                        </div>
                        {magicItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setMagicItems(
                                magicItems.filter((_, i) => i !== idx),
                              )
                            }
                            className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Target Word
                        </label>
                        <Input
                          type="text"
                          value={item.word}
                          onChange={(e) => {
                            const updated = [...magicItems];
                            updated[idx].word = e.target.value.toUpperCase();
                            // Reset hidden positions if word length shrank
                            updated[idx].hidden_positions = (
                              updated[idx].hidden_positions || []
                            ).filter((p) => p < e.target.value.length);
                            setMagicItems(updated);
                          }}
                          placeholder="e.g. CAT"
                          required
                        />
                      </div>

                      {/* Clickable letters for hidden positions */}
                      {letters.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            Click letters to hide (max 2):
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {letters.map((letter, letterIdx) => {
                              const isHidden = (
                                item.hidden_positions || []
                              ).includes(letterIdx);
                              return (
                                <button
                                  type="button"
                                  key={letterIdx}
                                  onClick={() => {
                                    const updated = [...magicItems];
                                    const currentHidden =
                                      updated[idx].hidden_positions || [];
                                    if (isHidden) {
                                      updated[idx].hidden_positions =
                                        currentHidden.filter(
                                          (p) => p !== letterIdx,
                                        );
                                    } else {
                                      if (currentHidden.length < 2) {
                                        updated[idx].hidden_positions = [
                                          ...currentHidden,
                                          letterIdx,
                                        ].sort((a, b) => a - b);
                                      }
                                    }
                                    setMagicItems(updated);
                                  }}
                                  className={`size-10 rounded-xl font-bold text-base transition-all cursor-pointer ${
                                    isHidden
                                      ? "bg-purple-600 text-white shadow-md ring-2 ring-purple-300"
                                      : "bg-white text-gray-800 border border-gray-300 hover:border-purple-400"
                                  }`}
                                >
                                  {isHidden ? "?" : letter}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Media row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                        {/* Video 1 */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Reference Video (Step 1)
                          </label>
                          <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-3">
                            {item.reference_video_url ? (
                              <video
                                src={resolveMediaUrl(item.reference_video_url)}
                                className="h-16 w-24 rounded-lg bg-black object-cover"
                                controls
                              />
                            ) : (
                              <Video className="size-8 text-gray-400" />
                            )}
                            <label className="cursor-pointer text-xs font-semibold text-(--primary) hover:underline">
                              {uploadingField === `mf_vid_${idx}`
                                ? `Uploading (${uploadProgress}%)...`
                                : item.reference_video_url
                                  ? "Replace Video"
                                  : "Upload Video"}
                              <input
                                type="file"
                                accept="video/*"
                                className="sr-only"
                                disabled={uploadingField !== null}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    handleFileUpload(
                                      f,
                                      (url) => {
                                        const updated = [...magicItems];
                                        updated[idx].reference_video_url = url;
                                        setMagicItems(updated);
                                      },
                                      `mf_vid_${idx}`,
                                    );
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Video 2 (if 2 letters hidden) */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Reference Video (Step 2 - Optional)
                          </label>
                          <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-3">
                            {item.reference_video_url_2 ? (
                              <video
                                src={resolveMediaUrl(
                                  item.reference_video_url_2,
                                )}
                                className="h-16 w-24 rounded-lg bg-black object-cover"
                                controls
                              />
                            ) : (
                              <Video className="size-8 text-gray-400" />
                            )}
                            <label className="cursor-pointer text-xs font-semibold text-(--primary) hover:underline">
                              {uploadingField === `mf_vid2_${idx}`
                                ? `Uploading (${uploadProgress}%)...`
                                : item.reference_video_url_2
                                  ? "Replace Video"
                                  : "Upload Video"}
                              <input
                                type="file"
                                accept="video/*"
                                className="sr-only"
                                disabled={uploadingField !== null}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    handleFileUpload(
                                      f,
                                      (url) => {
                                        const updated = [...magicItems];
                                        updated[idx].reference_video_url_2 =
                                          url;
                                        setMagicItems(updated);
                                      },
                                      `mf_vid2_${idx}`,
                                    );
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    setMagicItems([
                      ...magicItems,
                      {
                        word: "",
                        hidden_positions: [],
                        objective_image_url: "",
                        reference_video_url: "",
                        reference_video_url_2: "",
                        index_order: magicItems.length,
                      },
                    ])
                  }
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-sm font-semibold text-purple-700 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <Plus className="size-4" /> Add Magic Fingers Round
                </button>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploadingField !== null}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
