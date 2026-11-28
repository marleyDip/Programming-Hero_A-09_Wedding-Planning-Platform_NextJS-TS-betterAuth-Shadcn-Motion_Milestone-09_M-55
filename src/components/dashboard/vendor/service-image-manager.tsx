"use client";

/**
 * WedPlan - multi-photo uploader for services
 * Place at: components/dashboard/vendor/service-image-manager.tsx
 *
 * Up to 4 photos, uploaded to ImgBB through your /api/upload route (same route as the avatar uploader).
 * Drag & drop or click, live progress ring per photo, remove, "make cover" (first photo = cover),
 * retry on failure. Works for new services and for editing (pass the saved URLs as `images`).
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  ImagePlus,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

interface Upload {
  id: string;
  file: File;
  preview: string;
  progress: number;
  error?: string;
}

function uploadFile(
  file: File,
  onProgress: (p: number) => void,
  xhrs: Set<XMLHttpRequest>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhrs.add(xhr);
    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));

    xhr.onload = () => {
      xhrs.delete(xhr);

      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.url)
          resolve(data.url as string);
        else reject(new Error(data.error || "Image upload failed"));
      } catch {
        reject(new Error("Image upload failed"));
      }
    };

    xhr.onerror = () => {
      xhrs.delete(xhr);
      reject(new Error("Network error. Check your connection."));
    };

    xhr.onabort = () => reject(new Error("aborted"));
    const fd = new FormData();
    fd.append("image", file);
    xhr.send(fd);
  });
}

/**
 * Saved photo shown through the Next image optimizer (your server fetches it, so it still loads when the
 * browser can't reach i.ibb.co directly). A just-uploaded ImgBB link can take a moment to become available, so a failed load is retried a few
 * times (1s, 2s, 4s). If it still fails, a small tile with an "Open link" shortcut is shown instead of
 * a broken image, so you can test the link directly.
 */
function RetryImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [retryState, setRetryState] = useState({
    src,
    attempt: 0,
    failed: false,
  });
  const attempt = retryState.src === src ? retryState.attempt : 0;
  const failed = retryState.src === src && retryState.failed;

  if (failed)
    return (
      <div className="absolute inset-0 grid place-content-center gap-1 p-2 text-center text-[11px] text-muted-foreground">
        <span>Preview unavailable</span>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand underline"
        >
          Open link
        </a>
      </div>
    );

  const url = attempt
    ? `${src}${src.includes("?") ? "&" : "?"}r=${attempt}`
    : src;

  return (
    <Image
      key={attempt}
      src={url}
      alt={alt}
      fill
      sizes="(max-width: 640px) 50vw, 25vw"
      onError={() => {
        if (attempt >= 3) {
          setRetryState({ src, attempt, failed: true });
          return;
        }
        setTimeout(
          () => setRetryState({ src, attempt: attempt + 1, failed: false }),
          1000 * 2 ** attempt,
        );
      }}
      className={className}
    />
  );
}

const R = 20;
const C = 2 * Math.PI * R;

export default function ServiceImageManager({
  images,
  onChange,
  onBusyChange,
  max = 4,
  error,
}: {
  images: string[];
  onChange: (urls: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
  max?: number;
  error?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  const xhrs = useRef(new Set<XMLHttpRequest>());
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const uploading = uploads.some((u) => !u.error);
  useEffect(() => onBusyChange?.(uploading), [uploading, onBusyChange]);

  useEffect(() => {
    const set = xhrs.current;
    return () => set.forEach((x) => x.abort()); // cancel in-flight uploads when leaving the page
  }, []);

  const slotsLeft = max - images.length - uploads.length;

  const run = async (u: Upload) => {
    try {
      const url = await uploadFile(
        u.file,
        (p) =>
          setUploads((prev) =>
            prev.map((x) => (x.id === u.id ? { ...x, progress: p } : x)),
          ),
        xhrs.current,
      );
      URL.revokeObjectURL(u.preview);
      setUploads((prev) => prev.filter((x) => x.id !== u.id));
      onChange([...imagesRef.current, url]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      if (msg === "aborted") return;
      setUploads((prev) =>
        prev.map((x) =>
          x.id === u.id ? { ...x, error: msg, progress: 0 } : x,
        ),
      );
      toast.error("Photo upload failed", { description: msg });
    }
  };

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    let room = slotsLeft;
    if (room <= 0) {
      toast.error(`You can add up to ${max} photos.`);
      return;
    }

    for (const file of files) {
      if (room <= 0) {
        toast.info(
          `Only ${max} photos are allowed, so extra files were skipped.`,
        );
        break;
      }
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} isn't an image.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} is larger than 5 MB.`);
        continue;
      }
      room--;
      const u: Upload = {
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
      };
      setUploads((prev) => [...prev, u]);
      void run(u);
    }
  };

  const retry = (u: Upload) => {
    setUploads((prev) =>
      prev.map((x) =>
        x.id === u.id ? { ...x, error: undefined, progress: 0 } : x,
      ),
    );
    void run({ ...u, error: undefined });
  };

  const dropUpload = (u: Upload) => {
    URL.revokeObjectURL(u.preview);
    setUploads((prev) => prev.filter((x) => x.id !== u.id));
  };

  const makeCover = (i: number) =>
    onChange([images[i], ...images.filter((_, k) => k !== i)]);
  const remove = (i: number) => onChange(images.filter((_, k) => k !== i));

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnimatePresence initial={false}>
          {images.map((url, i) => (
            <motion.div
              // key={url}
              key={images.indexOf(url) === i ? url : `${url}#${i}`} // old data may already contain the same link twice
              layout
              initial={{ opacity: 0, scale: 0.8, rotateY: -40 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
              style={{ transformPerspective: 700 }}
              className="group relative aspect-4/3 overflow-hidden rounded-2xl border border-border bg-muted shadow-md"
            >
              <RetryImg
                src={url}
                alt={`Service photo ${i + 1}`}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />

              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />

              {i === 0 && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-900 shadow-md">
                  <Star className="h-3 w-3 fill-current" /> Cover
                </span>
              )}

              <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {i !== 0 ? (
                  <button
                    type="button"
                    onClick={() => makeCover(i)}
                    className="rounded-full bg-white/95 px-2.5 py-1.5 text-[10px] font-bold text-neutral-900 hover:bg-white"
                  >
                    Make cover
                  </button>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="grid h-8 w-8 place-items-center rounded-full bg-destructive text-white shadow-md hover:scale-110"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}

          {uploads.map((u) => (
            <motion.div
              key={u.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border bg-muted"
            >
              <Image
                src={u.preview}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                unoptimized
                className={`object-cover ${u.error ? "opacity-40 grayscale" : "opacity-60"}`}
              />

              {u.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 p-2 text-center backdrop-blur-sm">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                  <p className="line-clamp-2 text-[11px] font-medium text-destructive">
                    {u.error}
                  </p>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => retry(u)}
                      className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-foreground"
                    >
                      <RefreshCw className="h-3 w-3" /> Retry
                    </button>

                    <button
                      type="button"
                      onClick={() => dropUpload(u)}
                      className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="relative h-14 w-14">
                    <svg
                      viewBox="0 0 48 48"
                      className="h-full w-full -rotate-90"
                      aria-hidden
                    >
                      <circle
                        cx="24"
                        cy="24"
                        r={R}
                        fill="rgba(0,0,0,0.45)"
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth="4"
                      />

                      <motion.circle
                        cx="24"
                        cy="24"
                        r={R}
                        fill="none"
                        stroke="white"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={C}
                        animate={{
                          strokeDashoffset: C * (1 - u.progress / 100),
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 120,
                          damping: 20,
                        }}
                      />
                    </svg>

                    <span className="absolute inset-0 grid place-items-center text-[11px] font-bold text-white">
                      {u.progress < 100 ? (
                        `${u.progress}%`
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          {slotsLeft > 0 && (
            <motion.label
              key="add"
              layout
              htmlFor={inputId}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              whileHover={{ y: -3 }}
              className={`relative flex aspect-4/3 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border-2 border-dashed text-center transition-colors focus-within:ring-4 focus-within:ring-brand/30 ${
                dragging
                  ? "border-brand bg-brand-soft"
                  : error
                    ? "border-destructive/60 bg-destructive/5"
                    : "border-border bg-background hover:border-brand/60 hover:bg-brand-soft/50"
              }`}
            >
              <motion.span
                animate={dragging ? { y: [0, -6, 0] } : { y: 0 }}
                transition={{ duration: 0.8, repeat: dragging ? Infinity : 0 }}
                className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"
              >
                {dragging ? (
                  <UploadCloud className="h-5 w-5" />
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
              </motion.span>

              <span className="px-2 text-xs font-semibold">
                {dragging
                  ? "Drop to upload"
                  : images.length + uploads.length === 0
                    ? "Add cover photo"
                    : "Add photo"}
              </span>

              <span className="px-2 text-[10px] text-muted-foreground">
                {slotsLeft} left · max 5 MB
              </span>

              <input
                id={inputId}
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </motion.label>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        {error ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 font-medium text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </p>
        ) : (
          <p className="text-muted-foreground">
            The first photo is the cover customers see on cards. PNG, JPG, WEBP
            or GIF.
          </p>
        )}

        {images.length > 0 && !uploading && (
          <span className="inline-flex items-center gap-1 font-semibold text-success">
            <Check className="h-3.5 w-3.5" strokeWidth={3} /> {images.length} /{" "}
            {max} uploaded
          </span>
        )}
      </div>
    </div>
  );
}
