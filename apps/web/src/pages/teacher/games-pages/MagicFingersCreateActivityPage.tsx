import { Link, useNavigate } from "react-router-dom";
import Button from "../../../components/Button";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Flag,
  ImagePlus,
  Plus,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import StepIndicator from "../../../components/StepIndicator";
import Separator from "../../../components/Separator";
import Input from "../../../components/Input";
import Dropdown from "../../../components/Dropdown";
import { useState, type FormEvent } from "react";
import { createMagicFingersActivity, uploadMiniGameMedia, resolveMediaUrl } from "@/services/mini-games";
import type { MagicFingersItem } from "@/interfaces/mini-game.interface";

const steps = [
  {
    number: 1,
    label: "Basic Info",
  },
  {
    number: 2,
    label: "Add Content",
  },
  {
    number: 3,
    label: "Preview & Publish",
  },
];

const DRAFT_KEY = "teacher-magic-fingers-draft";

type MagicFingersPayload = {
  game_type: "magic_fingers";
  title: string;
  description: string;
  difficulty: number;
  items: MagicFingersItem[];
};

const initialGame: MagicFingersPayload = {
  game_type: "magic_fingers",
  title: "",
  description: "",
  difficulty: 1,
  items: [
    {
      word: "",
      hidden_positions: [1],
      objective_image_url: "",
      reference_video_url: "",
      reference_video_url_2: "",
      index_order: 0,
    },
  ],
};

function readDraft(): MagicFingersPayload {
  const draft = sessionStorage.getItem(DRAFT_KEY);
  return draft ? { ...initialGame, ...JSON.parse(draft) } : initialGame;
}

export function MagicFingersCreateActivityStepOnePage() {
  const [game, setGame] = useState<MagicFingersPayload>(readDraft);
  const saveDraft = () =>
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(game));

  return (
    <section className="space-y-6 mt-6">
      <StepIndicator steps={steps} step={1} />

      <article className="flex flex-col p-6 gap-6 bg-(--white) rounded-4xl shadow-lg/5">
        <div className="space-y-4">
          <h1 className="heading-3">Let's start with the basics</h1>
          <div>
            <label htmlFor="activity-title">Activity Title</label>
            <Input
              type="text"
              id="activity-title"
              placeholder="Enter activity title (e.g. Animals Fingerspelling, Common Objects)"
              value={game.title}
              onChange={(event) =>
                setGame({ ...game, title: event.target.value })
              }
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              placeholder="Enter a brief description of the fingerspelling activity"
              value={game.description}
              onChange={(event) =>
                setGame({ ...game, description: event.target.value })
              }
              className="resize-none p-4 w-full rounded-md border-2 border-(--border) bg-(--gray-50) paragraph-2 text-(--ghost) outline-none"
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="difficulty">Difficulty</label>
          <Dropdown
            value={String(game.difficulty)}
            onChange={(value) =>
              setGame({ ...game, difficulty: Number(value) })
            }
            className=""
            options={[
              { label: "Easy", value: "1" },
              { label: "Medium", value: "2" },
              { label: "Hard", value: "3" },
            ]}
          />
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <Link to="/teacher/tasks">
            <Button variant="destructive">
              Cancel <X />
            </Button>
          </Link>
          <Link to="../step-2" onClick={saveDraft}>
            <Button className="gap-2">
              Next Step
              <ChevronRight className="size-5" />
            </Button>
          </Link>
        </div>
      </article>
    </section>
  );
}

export function MagicFingersCreateActivityStepTwoPage() {
  const [game, setGame] = useState<MagicFingersPayload>(readDraft);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [showWordListModal, setShowWordListModal] = useState(false);
  const [bulkWordsInput, setBulkWordsInput] = useState("");

  const saveDraft = () =>
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(game));

  const updateItem = (index: number, update: Partial<MagicFingersItem>) => {
    setGame((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...update } : item,
      ),
    }));
  };

  const toggleHiddenPosition = (itemIndex: number, charIndex: number) => {
    const currentPositions = game.items[itemIndex].hidden_positions || [];
    const exists = currentPositions.includes(charIndex);
    let updated: number[];
    if (exists) {
      if (currentPositions.length === 1) return; // Keep at least 1 missing letter
      updated = currentPositions.filter((pos) => pos !== charIndex);
    } else {
      if (currentPositions.length >= 2) {
        // Allow up to 2 missing letters max
        updated = [currentPositions[1], charIndex];
      } else {
        updated = [...currentPositions, charIndex];
      }
    }
    updateItem(itemIndex, { hidden_positions: updated.sort((a, b) => a - b) });
  };

  const handleMediaFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    index: number,
    field: "objective_image_url" | "reference_video_url" | "reference_video_url_2",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadingTarget(`${index}_${field}`);
    setUploadProgress(0);
    setUploadError("");
    try {
      const res = await uploadMiniGameMedia(file, (percent) => setUploadProgress(percent));
      updateItem(index, { [field]: res.url });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload media",
      );
    } finally {
      setIsUploading(false);
      setUploadingTarget(null);
      setUploadProgress(0);
    }
  };

  const addRound = () =>
    setGame((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          word: "",
          hidden_positions: [1],
          objective_image_url: "",
          reference_video_url: "",
          reference_video_url_2: "",
          index_order: prev.items.length,
        },
      ],
    }));

  const duplicateRound = (index: number) => {
    setGame((prev) => {
      const source = prev.items[index];
      const cloned: MagicFingersItem = {
        ...source,
        id: undefined,
        index_order: index + 1,
      };
      const updated = [...prev.items];
      updated.splice(index + 1, 0, cloned);
      return {
        ...prev,
        items: updated.map((item, idx) => ({ ...item, index_order: idx })),
      };
    });
  };

  const moveRound = (index: number, direction: "up" | "down") => {
    setGame((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.items.length) return prev;
      const updated = [...prev.items];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return {
        ...prev,
        items: updated.map((item, idx) => ({ ...item, index_order: idx })),
      };
    });
  };

  const deleteRound = (index: number) =>
    setGame((prev) => ({
      ...prev,
      items: prev.items
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, index_order: itemIndex })),
    }));

  const handleBatchVideoDrop = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadError("");
    try {
      const newItems: MagicFingersItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]/g, " ")
          .trim()
          .toUpperCase();
        
        let uploadedUrl = "";
        try {
          const res = await uploadMiniGameMedia(file);
          uploadedUrl = res.url;
        } catch (uploadErr) {
          console.error("Batch upload failed for file:", file.name, uploadErr);
        }

        const defaultHidden = cleanName.length > 1 ? [1] : [0];
        newItems.push({
          word: cleanName || "WORD",
          hidden_positions: defaultHidden,
          objective_image_url: "",
          reference_video_url: uploadedUrl,
          reference_video_url_2: "",
          index_order: game.items.length + i,
        });
      }

      setGame((prev) => {
        // If current list only has 1 empty initial item, replace it
        const hasOnlyEmptyFirst =
          prev.items.length === 1 && !prev.items[0].word && !prev.items[0].reference_video_url;
        const baseItems = hasOnlyEmptyFirst ? [] : prev.items;
        const combined = [...baseItems, ...newItems].map((item, idx) => ({
          ...item,
          index_order: idx,
        }));
        return { ...prev, items: combined };
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Batch upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkWordsApply = () => {
    const lines = bulkWordsInput
      .split("\n")
      .map((l) => l.trim().toUpperCase())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const newItems: MagicFingersItem[] = lines.map((word, i) => ({
      word,
      hidden_positions: word.length > 1 ? [1] : [0],
      objective_image_url: "",
      reference_video_url: "",
      reference_video_url_2: "",
      index_order: game.items.length + i,
    }));

    setGame((prev) => {
      const hasOnlyEmptyFirst =
        prev.items.length === 1 && !prev.items[0].word && !prev.items[0].reference_video_url;
      const baseItems = hasOnlyEmptyFirst ? [] : prev.items;
      return {
        ...prev,
        items: [...baseItems, ...newItems].map((item, idx) => ({
          ...item,
          index_order: idx,
        })),
      };
    });

    setBulkWordsInput("");
    setShowWordListModal(false);
  };

  return (
    <section className="space-y-6 mt-6">
      <StepIndicator steps={steps} step={2} />

      {uploadError && (
        <div className="p-4 bg-red-100 text-red-700 rounded-xl text-sm">
          {uploadError}
        </div>
      )}

      {/* QoL Action Bar & Dropzone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Batch Video Dropzone */}
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--primary) bg-(--primary-light)/40 p-6 text-center transition-colors hover:bg-(--primary-light)">
          <UploadCloud className="size-8 text-(--primary)" />
          <span className="paragraph-2 font-semibold text-(--primary)">
            ⚡ Batch Upload Videos (Auto-Generates Rounds)
          </span>
          <span className="caption text-(--ghost)">
            Drop multiple .mp4 / .webm videos — words will be auto-named from filenames!
          </span>
          <input
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

        {/* Bulk Word List Paste Card */}
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/50 p-6 text-center">
          <FileText className="size-8 text-blue-600" />
          <span className="paragraph-2 font-semibold text-blue-700">
            📝 Quick Paste Word List
          </span>
          <span className="caption text-(--ghost)">
            Paste a list of vocabulary words (one per line) to quickly create empty rounds.
          </span>
          <Button
            type="button"
            variant="outline"
            className="mt-1 px-4 py-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
            onClick={() => setShowWordListModal(true)}
          >
            + Paste Words
          </Button>
        </div>
      </div>

      {/* Modal for bulk words paste */}
      {showWordListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-(--white) p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="heading-3">Quick Paste Vocabulary Words</h3>
              <button
                type="button"
                onClick={() => setShowWordListModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="caption text-(--ghost)">
              Enter or paste words, one word per line. Each word will create a new round with the missing letter pre-configured!
            </p>
            <textarea
              className="w-full h-40 p-3 rounded-2xl border-2 border-(--border) focus:border-(--primary) focus:outline-hidden font-mono uppercase text-sm"
              placeholder={"APPLE\nBANANA\nCAT\nDOG"}
              value={bulkWordsInput}
              onChange={(e) => setBulkWordsInput(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowWordListModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleBulkWordsApply}
                disabled={!bulkWordsInput.trim()}
              >
                Add Words
              </Button>
            </div>
          </div>
        </div>
      )}

      {game.items.map((item, index) => {
        const letters = (item.word || "").toUpperCase().split("");
        const hiddenSet = new Set(item.hidden_positions || []);

        return (
          <article
            key={item.index_order ?? index}
            className="flex flex-col gap-6 p-6 bg-(--white) rounded-4xl shadow-lg/5"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-(--primary) text-xs font-bold text-white">
                  {index + 1}
                </span>
                <Flag className="size-5" />
                <h1 className="heading-3">Round {index + 1}</h1>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Move Up */}
                <Button
                  type="button"
                  variant="outline"
                  className="px-2.5 py-1 text-xs"
                  disabled={index === 0}
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
                  disabled={index === game.items.length - 1}
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
                  onClick={() => duplicateRound(index)}
                  title="Duplicate round"
                >
                  <Copy className="size-4" />
                </Button>

                {/* Remove */}
                {game.items.length > 1 && (
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Word & Hidden Positions */}
              <div className="space-y-4">
                <div>
                  <label className="paragraph-2 font-semibold">Vocabulary Word</label>
                  <Input
                    type="text"
                    placeholder="Enter word (e.g. APPLE, CAT, DOG)"
                    value={item.word}
                    onChange={(e) => {
                      const newWord = e.target.value.toUpperCase();
                      const defaultHidden = newWord.length > 1 ? [1] : [0];
                      updateItem(index, {
                        word: newWord,
                        hidden_positions: defaultHidden,
                      });
                    }}
                    required
                  />
                </div>

                {letters.length > 0 && (
                  <div className="space-y-2">
                    <span className="caption font-semibold text-(--ghost) block">
                      Click letters below to toggle which letter(s) students must fingerspell:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {letters.map((char, charIdx) => {
                        const isHidden = hiddenSet.has(charIdx);
                        return (
                          <button
                            key={charIdx}
                            type="button"
                            onClick={() => toggleHiddenPosition(index, charIdx)}
                            className={`size-12 rounded-xl text-lg font-bold transition-all border-2 ${
                              isHidden
                                ? "bg-(--primary) text-(--white) border-(--primary) scale-105 shadow-md"
                                : "bg-(--gray-50) text-(--black) border-(--border) hover:border-(--primary)"
                            }`}
                          >
                            {char}
                          </button>
                        );
                      })}
                    </div>
                    <p className="caption text-(--primary) font-medium">
                      Student view:{" "}
                      <span className="font-mono text-base tracking-widest bg-(--gray-50) px-2 py-1 rounded">
                        {letters
                          .map((char, idx) => (hiddenSet.has(idx) ? "_" : char))
                          .join(" ")}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="caption font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-(--primary) border border-blue-200">
                        {hiddenSet.size} of 2 missing letters: {Array.from(hiddenSet).sort((a, b) => a - b).map(idx => letters[idx]).join(', ')}
                      </span>
                      {hiddenSet.size === 2 && (
                        <span className="caption text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          ✓ Solved in sequence by student
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Objective Image Upload */}
                <div className="space-y-2">
                  <span className="paragraph-2 font-semibold">Prompt Image</span>
                  <label className="flex flex-col min-h-40 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-4 text-center hover:border-(--primary) hover:bg-(--primary-light)">
                    {item.objective_image_url ? (
                      <img
                        src={resolveMediaUrl(item.objective_image_url)}
                        alt="Objective prompt"
                        className="max-h-32 max-w-full rounded-xl object-contain"
                      />
                    ) : (
                      <>
                        <ImagePlus className="size-8 text-(--primary)" />
                        <span className="caption font-semibold">Upload Prompt Image</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) =>
                        handleMediaFileChange(e, index, "objective_image_url")
                      }
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* Reference Video Uploads (Dedicated for each missing letter) */}
              {(() => {
                const sortedHidden = Array.from(hiddenSet).sort((a, b) => a - b);
                const firstChar = letters[sortedHidden[0]] || "";
                const secondChar = sortedHidden.length > 1 ? (letters[sortedHidden[1]] || "") : "";

                if (sortedHidden.length === 2) {
                  return (
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Video for Step 1 / Letter 1 */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-(--primary) text-xs font-bold text-(--white)">
                            1
                          </span>
                          <label className="paragraph-2 font-semibold">
                            Reference Video for Step 1 (Letter: {firstChar})
                          </label>
                        </div>
                        <label className="flex flex-col min-h-52 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-4 text-center transition-colors hover:border-(--primary) hover:bg-(--primary-light)">
                          {item.reference_video_url ? (
                            <div className="space-y-2 w-full">
                              <video
                                src={resolveMediaUrl(item.reference_video_url)}
                                controls
                                className="max-h-40 w-full rounded-xl"
                              />
                              <span className="caption text-green-600 font-semibold block">
                                ✓ Letter 1 ({firstChar}) uploaded. Click to change.
                              </span>
                            </div>
                          ) : (
                            <>
                              <Upload className="size-8 text-(--primary)" />
                              <span className="caption font-semibold text-(--black)">
                                {isUploading && uploadingTarget === `${index}_reference_video_url`
                                  ? `Uploading video (${uploadProgress}%)...`
                                  : isUploading
                                  ? "Uploading..."
                                  : `Upload Demo Video for '${firstChar}'`}
                              </span>
                              {isUploading && uploadingTarget === `${index}_reference_video_url` && (
                                <div className="w-full max-w-[180px] bg-gray-200 h-2 rounded-full overflow-hidden my-1">
                                  <div
                                    className="bg-(--primary) h-full transition-all duration-150 rounded-full"
                                    style={{ width: `${uploadProgress}%` }}
                                  />
                                </div>
                              )}
                              <span className="text-[11px] text-(--ghost)">
                                MP4, WebM up to 100MB
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

                      {/* Video for Step 2 / Letter 2 */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-(--white)">
                            2
                          </span>
                          <label className="paragraph-2 font-semibold">
                            Reference Video for Step 2 (Letter: {secondChar})
                          </label>
                        </div>
                        <label className="flex flex-col min-h-52 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-4 text-center transition-colors hover:border-(--primary) hover:bg-(--primary-light)">
                          {item.reference_video_url_2 ? (
                            <div className="space-y-2 w-full">
                              <video
                                src={resolveMediaUrl(item.reference_video_url_2)}
                                controls
                                className="max-h-40 w-full rounded-xl"
                              />
                              <span className="caption text-green-600 font-semibold block">
                                ✓ Letter 2 ({secondChar}) uploaded. Click to change.
                              </span>
                            </div>
                          ) : (
                            <>
                              <Upload className="size-8 text-blue-600" />
                              <span className="caption font-semibold text-(--black)">
                                {isUploading ? "Uploading video..." : `Upload Demo Video for '${secondChar}'`}
                              </span>
                              <span className="text-[11px] text-(--ghost)">
                                MP4, WebM up to 100MB
                              </span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                            onChange={(event) =>
                              handleMediaFileChange(event, index, "reference_video_url_2")
                            }
                            disabled={isUploading}
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>
                  );
                }

                // Default 1 missing letter
                return (
                  <div className="space-y-4">
                    <label className="paragraph-2 font-semibold">
                      Reference Video (Demonstration for Missing Letter: {firstChar || "Word"})
                    </label>
                    <label className="flex flex-col min-h-60 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-6 text-center transition-colors hover:border-(--primary) hover:bg-(--primary-light)">
                      {item.reference_video_url ? (
                        <div className="space-y-2 w-full">
                          <video
                            src={resolveMediaUrl(item.reference_video_url)}
                            controls
                            className="max-h-48 w-full rounded-xl"
                          />
                          <span className="caption text-green-600 font-semibold block">
                            ✓ Video uploaded. Click to change.
                          </span>
                        </div>
                      ) : (
                        <>
                          <Upload className="size-10 text-(--primary)" />
                          <span className="paragraph-2 font-semibold text-(--black)">
                            {isUploading ? "Uploading video..." : `Click to upload demo video for '${firstChar || "letter"}'`}
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
                );
              })()}
            </div>
          </article>
        );
      })}

      <button
        type="button"
        onClick={addRound}
        className="w-full flex flex-col bg-white border-2 border-dashed border-(--border) rounded-2xl p-6 items-center justify-center gap-2 transition-colors hover:border-(--primary) hover:bg-(--primary-light)"
      >
        <div className="w-fit rounded-full bg-(--primary) p-2 text-(--white)">
          <Plus className="size-4" />
        </div>
        <span className="paragraph-2 font-semibold text-(--primary)">
          Add another round
        </span>
      </button>

      <Separator />

      <div className="flex items-center justify-between">
        <Link to="../step-1">
          <Button>
            <ChevronLeft className="size-5" />
            Back
          </Button>
        </Link>
        <Link to="../step-3" onClick={saveDraft}>
          <Button className="gap-2">
            Next Step
            <ChevronRight className="size-5" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export function MagicFingersCreateActivityStepThreePage() {
  const [game] = useState<MagicFingersPayload>(readDraft);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handlePublish = async (event: FormEvent) => {
    event.preventDefault();
    setIsPublishing(true);
    setError("");

    try {
      await createMagicFingersActivity({
        title: game.title || "Magic Fingers Activity",
        description: game.description,
        difficulty: game.difficulty,
        items: game.items.map((item, idx) => ({
          word: (item.word || "").toUpperCase(),
          hidden_positions: item.hidden_positions || [1],
          objective_image_url: item.objective_image_url || undefined,
          reference_video_url: item.reference_video_url || undefined,
          reference_video_url_2: item.reference_video_url_2 || undefined,
          index_order: idx,
        })),
      });

      sessionStorage.removeItem(DRAFT_KEY);
      navigate("/teacher/tasks");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to publish activity",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <section className="space-y-6 mt-6">
      <StepIndicator steps={steps} step={3} />

      <article className="space-y-6 rounded-4xl border-2 border-dashed border-(--primary) bg-(--white) p-6 shadow-lg/5">
        <header className="grid gap-6 md:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <p className="caption font-semibold uppercase tracking-wide text-(--primary)">
              Magic Fingers Activity
            </p>
            <h1 className="heading-2 text-(--black)">
              {game.title || "Untitled Activity"}
            </h1>
            <p className="paragraph-2 whitespace-pre-wrap text-(--ghost)">
              {game.description || "No description provided."}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 md:min-w-56 md:grid-cols-1">
            <div className="rounded-2xl bg-(--gray-50) p-4">
              <dt className="caption text-(--black)/50">Difficulty</dt>
              <dd className="paragraph-1 font-semibold text-(--black)">
                {game.difficulty === 1
                  ? "Easy"
                  : game.difficulty === 2
                    ? "Medium"
                    : "Hard"}
              </dd>
            </div>
            <div className="rounded-2xl bg-(--gray-50) p-4">
              <dt className="caption text-(--black)/50">Rounds</dt>
              <dd className="paragraph-1 font-semibold text-(--black)">
                {game.items.length}
              </dd>
            </div>
          </dl>
        </header>

        <Separator />

        <div className="space-y-4">
          <h2 className="heading-3">Rounds Preview</h2>
          <div className="space-y-4">
            {game.items.map((item, index) => {
              const letters = (item.word || "").toUpperCase().split("");
              const hiddenSet = new Set(item.hidden_positions || []);

              return (
                <article
                  key={index}
                  className="grid gap-5 rounded-2xl border-2 border-(--border) bg-(--gray-50) p-5 lg:grid-cols-2"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-full bg-(--primary) font-semibold text-(--white)">
                        {index + 1}
                      </span>
                      <h3 className="heading-4">Round {index + 1}: {item.word}</h3>
                    </div>
                    <div className="rounded-xl bg-(--white) p-4">
                      <div className="flex items-center justify-between">
                        <p className="caption text-(--black)/50">Fingerspelling Target</p>
                        <span className="caption font-semibold text-(--primary) bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          {hiddenSet.size} missing {hiddenSet.size === 2 ? '(Solved in sequence)' : ''}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {letters.map((char, cIdx) => {
                          const isHidden = hiddenSet.has(cIdx);
                          const hiddenOrder = Array.from(hiddenSet).sort((a, b) => a - b).indexOf(cIdx);
                          return (
                            <div key={cIdx} className="flex flex-col items-center">
                              <span
                                className={`size-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                                  isHidden
                                    ? "bg-(--primary) text-(--white) shadow-sm"
                                    : "bg-(--gray-50) text-(--black) border"
                                }`}
                              >
                                {char}
                              </span>
                              {isHidden && (
                                <span className="text-[10px] font-bold text-(--primary) mt-1">
                                  Step {hiddenOrder + 1}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {item.objective_image_url && (
                      <img
                        src={resolveMediaUrl(item.objective_image_url)}
                        alt="Prompt"
                        className="size-24 rounded-xl object-contain bg-white p-1 border"
                      />
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="paragraph-2 font-semibold text-(--black)">
                      Reference Video{hiddenSet.size === 2 ? "s" : ""}
                    </p>
                    {hiddenSet.size === 2 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <span className="caption font-semibold text-(--primary) block mb-1">
                            Step 1 Video
                          </span>
                          {item.reference_video_url ? (
                            <video
                              src={resolveMediaUrl(item.reference_video_url)}
                              controls
                              className="max-h-40 w-full rounded-xl bg-black"
                            />
                          ) : (
                            <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-(--border) bg-(--white) p-3 text-center">
                              <p className="text-[11px] text-(--ghost)">No video for Step 1</p>
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="caption font-semibold text-blue-600 block mb-1">
                            Step 2 Video
                          </span>
                          {item.reference_video_url_2 ? (
                            <video
                              src={resolveMediaUrl(item.reference_video_url_2)}
                              controls
                              className="max-h-40 w-full rounded-xl bg-black"
                            />
                          ) : (
                            <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-(--border) bg-(--white) p-3 text-center">
                              <p className="text-[11px] text-(--ghost)">No video for Step 2</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : item.reference_video_url ? (
                      <video
                        src={resolveMediaUrl(item.reference_video_url)}
                        controls
                        className="max-h-52 w-full rounded-xl bg-black"
                      />
                    ) : (
                      <div className="flex min-h-36 items-center justify-center rounded-xl border-2 border-dashed border-(--border) bg-(--white) p-6 text-center">
                        <p className="caption text-(--ghost)">
                          No reference video uploaded for this round.
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </article>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <Link to="../step-2">
            <Button>
              <ChevronLeft className="size-5" />
              Back
            </Button>
          </Link>
          <Link to="/teacher/tasks">
            <Button variant="destructive">
              Cancel <X />
            </Button>
          </Link>
        </div>
        <div className="flex gap-4 items-center">
          {error && (
            <p className="paragraph-2 text-red-600 font-medium" role="alert">
              {error}
            </p>
          )}
          <Button
            className="gap-2"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? "Publishing..." : "Publish"}{" "}
            <Upload className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
