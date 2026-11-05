import { Link } from "react-router-dom";
import Button from "../components/Button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-(--primary-500) flex flex-col p-4 sm:p-6">
      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 sm:gap-12 py-8">
        <div className="flex flex-col items-center gap-3 sm:gap-4 text-center">
          <img className="size-24 sm:size-32 object-contain" src="/logo.png" alt="Logo" />
          <h1 className="text-(--primary) text-3xl sm:text-4xl font-extrabold tracking-tight">
            Welcome to ELOCIA
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm max-w-xs sm:max-w-md">
            Filipino Sign Language Expression & Structural Learning System
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 w-full max-w-xs sm:max-w-sm">
          <p className="font-semibold text-gray-700 text-sm sm:text-base">I am logging in as...</p>

          <ul className="flex flex-col gap-3 sm:gap-4 w-full">
            <li>
              <Link to="/teacher/login" className="block w-full">
                <Button variant="default" className="w-full py-3.5 sm:py-3 text-base shadow-sm">
                  Teacher
                </Button>
              </Link>
            </li>

            <li>
              <Link to="/parent/login" className="block w-full">
                <Button variant="default" className="w-full py-3.5 sm:py-3 text-base shadow-sm">
                  Parent
                </Button>
              </Link>
            </li>
          </ul>
        </div>
      </div>

    </main>
  );
}
