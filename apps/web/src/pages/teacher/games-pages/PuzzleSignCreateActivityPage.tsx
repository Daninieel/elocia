import { Link, useNavigate } from "react-router-dom";
import Button from "../../../components/Button";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Copy,
  Flag,
  ImagePlus,
  Layers,
  Plus,
  Upload,
  X,
} from "lucide-react";
import StepIndicator from "../../../components/StepIndicator";
import Separator from "../../../components/Separator";
import Input from "../../../components/Input";
import Dropdown from "../../../components/Dropdown";
import { useState, type FormEvent } from "react";
import { createPuzzleSignActivity, uploadMiniGameMedia, resolveMediaUrl } from "@/services/mini-games";
import type { PuzzleSignItem } from "@/interfaces/mini-game.interface";

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

const DRAFT_KEY = "teacher-puzzle-sign-draft";

type PuzzleSignPayload = {
  game_type: "puzzle_sign";
  title: string;
  description: string;
  difficulty: number;
  items: PuzzleSignItem[];
};

const initialGame: PuzzleSignPayload = {
  game_type: "puzzle_sign",
  title: "",
  description: "",
  difficulty: 1,
  items: [
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
};

function readDraft(): PuzzleSignPayload {
  const draft = sessionStorage.getItem(DRAFT_KEY);
  return draft ? { ...initialGame, ...JSON.parse(draft) } : initialGame;
}

export function PuzzleSignCreateActivityStepOnePage() {
  const [game, setGame] = useState<PuzzleSignPayload>(readDraft);
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
              placeholder="Enter activity title (e.g. Addition Signs, Animal Puzzles)"
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
              placeholder="Enter a brief description of the activity"
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

export function PuzzleSignCreateActivityStepTwoPage() {
  const [game, setGame] = useState<PuzzleSignPayload>(readDraft);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");

  const saveDraft = () =>
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(game));

  const updateItem = (index: number, update: Partial<PuzzleSignItem>) => {
    setGame((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...update } : item,
      ),
    }));
  };

  const duplicateRound = (index: number) => {
    setGame((prev) => {
      const source = prev.items[index];
      const cloned: PuzzleSignItem = {
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

  const swapImagesInRound = (index: number) => {
    setGame((prev) => {
      const current = prev.items[index];
      if (!current) return prev;
      const isSlot1 = (current.missing_position || 2) === 1;

      if (isSlot1) {
        const knownImg = current.word_two_image_url || current.word_one_image_url || "";
        const resultImg = current.word_form_image_url || "";
        return {
          ...prev,
          items: prev.items.map((it, i) =>
            i === index
              ? {
                  ...it,
                  word_two_image_url: resultImg,
                  word_one_image_url: resultImg,
                  word_form_image_url: knownImg,
                }
              : it,
          ),
        };
      } else {
        const knownImg = current.word_one_image_url || "";
        const resultImg = current.word_form_image_url || "";
        return {
          ...prev,
          items: prev.items.map((it, i) =>
            i === index
              ? {
                  ...it,
                  word_one_image_url: resultImg,
                  word_form_image_url: knownImg,
                }
              : it,
          ),
        };
      }
    });
  };



  const handleMediaFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    index: number,
    field: "word_one_image_url" | "word_two_image_url" | "word_form_image_url" | "reference_video_url",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    updateItem(index, { [field]: localUrl });

    // Auto-populate hidden word if video and field empty
    if (field === "reference_video_url") {
      const currentWord = game.items[index]?.hidden_word;
      if (!currentWord || !currentWord.trim()) {
        const raw = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
        const clean = raw.charAt(0).toUpperCase() + raw.slice(1);
        updateItem(index, { hidden_word: clean, [field]: localUrl });
      }
    }

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



  // ── QoL 2: Card Multi-Drop (Drop 2 images + 1 video onto a single card at once) ─
  const handleCardMultiDrop = async (index: number, files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadError("");
    try {
      const updates: Partial<PuzzleSignItem> = {};
      const currentItem = game.items[index];
      const isSlot1 = (currentItem.missing_position || 2) === 1;

      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
        const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

        if (["mp4", "webm", "mov", "mkv"].includes(ext)) {
          const res = await uploadMiniGameMedia(file);
          updates.reference_video_url = res.url;
          if (!currentItem.hidden_word) {
            updates.hidden_word = capitalized;
          }
        } else if (["png", "jpg", "jpeg", "webp", "svg"].includes(ext)) {
          const res = await uploadMiniGameMedia(file);
          const imgUrl = res.url;
          // First image goes to known item, second goes to result form
          if (isSlot1) {
            if (!updates.word_two_image_url && !currentItem.word_two_image_url) {
              updates.word_two_image_url = imgUrl;
              updates.word_one_image_url = imgUrl;
              if (!currentItem.word_two && !currentItem.word_one) updates.word_two = capitalized;
            } else if (!updates.word_form_image_url) {
              updates.word_form_image_url = imgUrl;
              if (!currentItem.word_form) updates.word_form = capitalized;
            }
          } else {
            if (!updates.word_one_image_url && !currentItem.word_one_image_url) {
              updates.word_one_image_url = imgUrl;
              if (!currentItem.word_one) updates.word_one = capitalized;
            } else if (!updates.word_form_image_url) {
              updates.word_form_image_url = imgUrl;
              if (!currentItem.word_form) updates.word_form = capitalized;
            }
          }
        }
      }

      updateItem(index, updates);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Card file drop failed");
    } finally {
      setIsUploading(false);
    }
  };

  // ── QoL 3: Ctrl+V Paste from Clipboard ───────────────────────────────────────
  const handlePasteImageOnCard = async (
    e: React.ClipboardEvent<HTMLElement>,
    index: number,
    targetSlot?: "known" | "result",
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (!blob) continue;

        e.preventDefault();
        setIsUploading(true);
        setUploadError("");
        try {
          const file = new File([blob], `pasted_img_${Date.now()}.png`, { type: blob.type });
          const res = await uploadMiniGameMedia(file);
          const imgUrl = res.url;

          const isSlot1 = (game.items[index]?.missing_position || 2) === 1;
          if (targetSlot === "known") {
            if (isSlot1) {
              updateItem(index, { word_two_image_url: imgUrl, word_one_image_url: imgUrl });
            } else {
              updateItem(index, { word_one_image_url: imgUrl });
            }
          } else if (targetSlot === "result") {
            updateItem(index, { word_form_image_url: imgUrl });
          } else {
            // Auto slot: if known has no image, place in known; else place in result
            const hasKnown = isSlot1
              ? Boolean(game.items[index]?.word_two_image_url || game.items[index]?.word_one_image_url)
              : Boolean(game.items[index]?.word_one_image_url);

            if (!hasKnown) {
              if (isSlot1) {
                updateItem(index, { word_two_image_url: imgUrl, word_one_image_url: imgUrl });
              } else {
                updateItem(index, { word_one_image_url: imgUrl });
              }
            } else {
              updateItem(index, { word_form_image_url: imgUrl });
            }
          }
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : "Failed to paste image");
        } finally {
          setIsUploading(false);
        }
        break;
      }
    }
  };

  const addRound = () =>
    setGame((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          word_one: "",
          word_two: "",
          hidden_word: "",
          word_form: "",
          missing_position: 1,
          word_one_image_url: "",
          word_two_image_url: "",
          word_form_image_url: "",
          reference_video_url: "",
          index_order: prev.items.length,
        },
      ],
    }));

  const deleteRound = (index: number) =>
    setGame((prev) => ({
      ...prev,
      items: prev.items
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, index_order: itemIndex })),
    }));

  return (
    <section className="space-y-6 mt-6">
      <StepIndicator steps={steps} step={2} />

      {uploadError && (
        <div className="p-4 bg-red-100 text-red-700 rounded-xl text-sm">
          {uploadError}
        </div>
      )}

      {game.items.map((item, index) => (
        <article
          key={item.index_order ?? index}
          onPaste={(e) => handlePasteImageOnCard(e, index)}
          tabIndex={0}
          className="flex flex-col gap-6 p-6 bg-(--white) rounded-4xl shadow-lg/5 focus:ring-2 focus:ring-(--primary)/20 outline-none transition-all relative"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-(--primary) text-xs font-bold text-white">
                {index + 1}
              </span>
              <Flag className="size-5" />
              <h1 className="heading-3">Round {index + 1}</h1>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Swap Images in this Round */}
              <Button
                type="button"
                variant="outline"
                className="px-2.5 py-1 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-200"
                onClick={() => swapImagesInRound(index)}
                title="Swap images between the given item and result item"
              >
                <ArrowLeftRight className="size-4 mr-1 text-amber-600" />
                Swap Images
              </Button>

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

          {/* ── QoL 2 & 3: Round Multi-Drop Bar & Clipboard Paste Hint ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-blue-50/60 border border-blue-200">
            <div className="flex items-center gap-2 text-xs text-blue-900">
              <Clipboard className="size-4 text-blue-600 shrink-0" />
              <span>
                <strong className="font-semibold">Quick Media:</strong> Drop files below or click here & press <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border rounded shadow-xs">Ctrl+V</kbd> to paste any copied image!
              </span>
            </div>

            {/* In-Card Multi-Drop button/zone */}
            <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shrink-0 shadow-xs">
              <Layers className="size-3.5" />
              Drop Media for this Round
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="sr-only"
                disabled={isUploading}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  handleCardMultiDrop(index, files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {/* Missing Position Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
              <div>
                <span className="paragraph-2 font-bold text-amber-900 block">
                  Which item is missing in this equation?
                </span>
                <span className="caption text-amber-700">
                  Select which piece of the puzzle the student must sign.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateItem(index, { missing_position: 1 })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    (item.missing_position || 2) === 1
                      ? "bg-(--primary) text-white border-(--primary) shadow-sm"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Slot 1: [ ? ] + Word 2 = Result
                </button>
                <button
                  type="button"
                  onClick={() => updateItem(index, { missing_position: 2 })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    (item.missing_position || 2) === 2
                      ? "bg-(--primary) text-white border-(--primary) shadow-sm"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Slot 2: Word 1 + [ ? ] = Result
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* If Slot 1 is missing, show Target Sign first. If Slot 2 is missing, show Word 1 first. */}
              {(item.missing_position || 2) === 1 ? (
                <>
                  {/* Slot 1: Target Sign Answer (Missing) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded-full bg-(--primary) text-[11px] font-bold text-white">1</span>
                      <span className="paragraph-2 font-semibold text-(--primary)">Target Sign Answer [ ? ] (Missing)</span>
                    </div>
                    <Input
                      type="text"
                      placeholder="e.g. Ear"
                      value={item.hidden_word}
                      onChange={(e) => updateItem(index, { hidden_word: e.target.value })}
                      required
                    />
                    <div className="p-3 bg-(--primary-light) rounded-xl text-xs text-(--primary) font-medium">
                      Student must sign: <span className="font-bold underline">[{item.hidden_word || 'Target'}]</span> + {item.word_two || item.word_one || 'Word 2'} = {item.word_form || 'Result'}
                    </div>
                  </div>

                  {/* Slot 2: Word 2 (Known Given) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="flex size-5 items-center justify-center rounded-full bg-gray-600 text-[11px] font-bold text-white">2</span>
                        <span className="paragraph-2 font-semibold">Word 2 (Known Item)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => swapImagesInRound(index)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg transition-colors"
                        title="Swap image with Result image"
                      >
                        <ArrowLeftRight className="size-3 text-amber-600" />
                        Swap Image
                      </button>
                    </div>
                    <Input
                      type="text"
                      placeholder="e.g. Ring"
                      value={item.word_two || item.word_one}
                      onChange={(e) => updateItem(index, { word_two: e.target.value, word_one: e.target.value })}
                      required
                    />
                    <label className="flex flex-col min-h-40 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-4 text-center hover:border-(--primary) hover:bg-(--primary-light)">
                      {(item.word_two_image_url || item.word_one_image_url) ? (
                        <img
                          src={resolveMediaUrl(item.word_two_image_url || item.word_one_image_url)}
                          alt="Word 2"
                          className="max-h-28 max-w-full rounded-xl object-contain"
                        />
                      ) : (
                        <>
                          <ImagePlus className="size-8 text-(--primary)" />
                          <span className="caption font-semibold">Upload Image 2 (Ring)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          handleMediaFileChange(e, index, "word_two_image_url");
                          handleMediaFileChange(e, index, "word_one_image_url");
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  {/* Slot 1: Word 1 (Known Item) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="flex size-5 items-center justify-center rounded-full bg-gray-600 text-[11px] font-bold text-white">1</span>
                        <span className="paragraph-2 font-semibold">Word 1 (Known Item)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => swapImagesInRound(index)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg transition-colors"
                        title="Swap image with Result image"
                      >
                        <ArrowLeftRight className="size-3 text-amber-600" />
                        Swap Image
                      </button>
                    </div>
                    <Input
                      type="text"
                      placeholder="e.g. 1 or Sun or Rain"
                      value={item.word_one}
                      onChange={(e) => updateItem(index, { word_one: e.target.value })}
                      required
                    />
                    <label className="flex flex-col min-h-40 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-4 text-center hover:border-(--primary) hover:bg-(--primary-light)">
                      {item.word_one_image_url ? (
                        <img
                          src={resolveMediaUrl(item.word_one_image_url)}
                          alt="Word 1"
                          className="max-h-28 max-w-full rounded-xl object-contain"
                        />
                      ) : (
                        <>
                          <ImagePlus className="size-8 text-(--primary)" />
                          <span className="caption font-semibold">Upload Image 1</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleMediaFileChange(e, index, "word_one_image_url")}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {/* Slot 2: Target Sign Answer (Missing) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded-full bg-(--primary) text-[11px] font-bold text-white">2</span>
                      <span className="paragraph-2 font-semibold text-(--primary)">Target Sign Answer [ ? ] (Missing)</span>
                    </div>
                    <Input
                      type="text"
                      placeholder="e.g. 1 or Cloud or Bow"
                      value={item.hidden_word}
                      onChange={(e) => updateItem(index, { hidden_word: e.target.value })}
                      required
                    />
                    <div className="p-3 bg-(--primary-light) rounded-xl text-xs text-(--primary) font-medium">
                      Student must sign: {item.word_one || 'Word 1'} + <span className="font-bold underline">[{item.hidden_word || 'Target'}]</span> = {item.word_form || 'Result'}
                    </div>
                  </div>
                </>
              )}

              {/* Slot 3: Result Word / Item (Combined Form) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">=</span>
                    <span className="paragraph-2 font-semibold">Result (Combined Form)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => swapImagesInRound(index)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg transition-colors"
                    title="Swap image with Given Word image"
                  >
                    <ArrowLeftRight className="size-3 text-amber-600" />
                    Swap Image
                  </button>
                </div>
                <Input
                  type="text"
                  placeholder="e.g. Earring, Rainbow"
                  value={item.word_form}
                  onChange={(e) => updateItem(index, { word_form: e.target.value })}
                  required
                />
                <label className="flex flex-col min-h-40 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-4 text-center hover:border-(--primary) hover:bg-(--primary-light)">
                  {item.word_form_image_url ? (
                    <img
                      src={resolveMediaUrl(item.word_form_image_url)}
                      alt="Result"
                      className="max-h-28 max-w-full rounded-xl object-contain"
                    />
                  ) : (
                    <>
                      <ImagePlus className="size-8 text-(--primary)" />
                      <span className="caption font-semibold">Upload Result Image</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleMediaFileChange(e, index, "word_form_image_url")}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

          {/* Reference Video Upload */}
          <div className="space-y-3 pt-2">
            <label className="paragraph-2 font-semibold">Reference Video (Sign Demonstration)</label>
            <label className="flex flex-col min-h-48 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-6 text-center transition-colors hover:border-(--primary) hover:bg-(--primary-light)">
              {item.reference_video_url ? (
                <div className="space-y-2">
                  <video
                    src={resolveMediaUrl(item.reference_video_url)}
                    controls
                    className="max-h-40 max-w-full rounded-xl"
                  />
                  <span className="caption text-green-600 font-semibold block">
                    ✓ Video uploaded. Click to change.
                  </span>
                </div>
              ) : (
                <>
                  <Upload className="size-10 text-(--primary)" />
                  <span className="paragraph-2 font-semibold text-(--black)">
                    {isUploading && uploadingTarget === `${index}_reference_video_url`
                      ? `Uploading video (${uploadProgress}%)...`
                      : isUploading
                      ? "Uploading..."
                      : "Click to upload demonstration video"}
                  </span>
                  {isUploading && uploadingTarget === `${index}_reference_video_url` && (
                    <div className="w-full max-w-[200px] bg-gray-200 h-2 rounded-full overflow-hidden my-1">
                      <div
                        className="bg-(--primary) h-full transition-all duration-150 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
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
        </article>
      ))}

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

export function PuzzleSignCreateActivityStepThreePage() {
  const [game] = useState<PuzzleSignPayload>(readDraft);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handlePublish = async (event: FormEvent) => {
    event.preventDefault();
    setIsPublishing(true);
    setError("");

    try {
      await createPuzzleSignActivity({
        title: game.title || "Puzzle Sign Activity",
        description: game.description,
        difficulty: game.difficulty,
        items: game.items.map((item, idx) => {
          const isSlot1 = (item.missing_position || 2) === 1;
          return {
            word_one: isSlot1 ? "+" : item.word_one,
            word_two: isSlot1 ? (item.word_two || item.word_one) : (item.word_two || "+"),
            hidden_word: item.hidden_word,
            word_form: item.word_form,
            word_one_image_url: isSlot1 ? undefined : (item.word_one_image_url || undefined),
            word_two_image_url: isSlot1
              ? (item.word_two_image_url || item.word_one_image_url || undefined)
              : (item.word_two_image_url || undefined),
            word_form_image_url: item.word_form_image_url || undefined,
            reference_video_url: item.reference_video_url || undefined,
            index_order: idx,
          };
        }),
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
              Puzzle Sign Activity
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
            {game.items.map((item, index) => (
              <article
                key={index}
                className="grid gap-5 rounded-2xl border-2 border-(--border) bg-(--gray-50) p-5 lg:grid-cols-2"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-full bg-(--primary) font-semibold text-(--white)">
                      {index + 1}
                    </span>
                    <h3 className="heading-4">Round {index + 1}</h3>
                  </div>
                  <div className="rounded-xl bg-(--white) p-4 flex items-center justify-between">
                    <div>
                      <p className="caption text-(--black)/50">Equation</p>
                      <p className="paragraph-1 font-bold text-(--black)">
                        {(item.missing_position || 2) === 1 ? (
                          <>
                            <span className="text-(--primary)">[{item.hidden_word || "?"}]</span> + {item.word_two || item.word_one || "?"} = {item.word_form || "?"}
                          </>
                        ) : (
                          <>
                            {item.word_one || "?"} + <span className="text-(--primary)">[{item.hidden_word || "?"}]</span> = {item.word_form || "?"}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {((item.missing_position || 2) === 1 ? (item.word_two_image_url || item.word_one_image_url) : item.word_one_image_url) && (
                      <img
                        src={resolveMediaUrl((item.missing_position || 2) === 1 ? (item.word_two_image_url || item.word_one_image_url) : item.word_one_image_url)}
                        alt="Known Item"
                        className="size-20 rounded-xl object-contain bg-white p-1 border"
                      />
                    )}
                    {item.word_form_image_url && (
                      <img
                        src={resolveMediaUrl(item.word_form_image_url)}
                        alt="Result"
                        className="size-20 rounded-xl object-contain bg-white p-1 border"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="paragraph-2 font-semibold text-(--black)">
                    Reference Video
                  </p>
                  {item.reference_video_url ? (
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
            ))}
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
