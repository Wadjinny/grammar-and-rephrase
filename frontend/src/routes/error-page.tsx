import { isRouteErrorResponse, useRouteError, Link } from "react-router";

export default function ErrorPage() {
  const error = useRouteError();

  let title = "Something went wrong";
  let message = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Page not found" : `Error ${error.status}`;
    message =
      typeof error.data === "string"
        ? error.data
        : error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <div className="w-12 h-12 rounded-ctrl bg-indigo-50 flex items-center justify-center">
        <span className="text-indigo-600 font-bold text-lg">G</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
      <p className="text-[13px] text-gray-500 max-w-sm">{message}</p>
      <Link
        to="/"
        className="mt-2 rounded-full bg-indigo-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-pop hover:bg-indigo-700 transition"
      >
        Back to editor
      </Link>
    </div>
  );
}
