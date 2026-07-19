import { createBrowserRouter } from "react-router";
import RootLayout from "./routes/root";
import HomePage from "./routes/home";
import HistoryPage from "./routes/history";
import ErrorPage from "./routes/error-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "history", element: <HistoryPage /> },
    ],
  },
]);
