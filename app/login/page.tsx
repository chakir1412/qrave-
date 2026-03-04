import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4 text-sm text-gray-500"
          style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
        >
          Lädt Login…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
