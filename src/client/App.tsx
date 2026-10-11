import { Outlet } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TourTabs from "./components/TourTabs";

export default function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <TourTabs />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
