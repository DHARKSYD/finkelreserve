import { AnimatePresence, motion } from "framer-motion";
import resetImage from "@/assets/auth/auth-reset.svg";
import signinImage from "@/assets/auth/auth-signin.svg";
import signupImage from "@/assets/auth/auth-signup.svg";

export type AuthPhotoVariant = "signin" | "signup" | "reset";

// One picture per auth screen. These are original illustrations. To use a photograph instead,
// put a .jpg or .webp in src/assets/auth and point the matching import above at it; nothing
// else changes. The images are decorative, so they carry no alt text.
const PICTURES: Record<AuthPhotoVariant, string> = {
  signin: signinImage,
  signup: signupImage,
  reset: resetImage,
};

// Desktop only: on phones the form comes first and the picture would only push it down. The
// panel stretches to the height of the form next to it, and the picture is cropped to fit.
export function AuthPhotoPanel({ variant }: { variant: AuthPhotoVariant }) {
  return (
    <div
      aria-hidden="true"
      className="relative hidden min-h-[30rem] overflow-hidden rounded-3xl bg-stone-950 md:block"
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={variant}
          src={PICTURES[variant]}
          alt=""
          loading="lazy"
          decoding="async"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>
    </div>
  );
}
