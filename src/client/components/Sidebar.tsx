import { useState } from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/customers", label: "Customers" },
  { to: "/tours", label: "Tours" },
  { to: "/tasks", label: "Tasks" },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-logo">M</div>
          <span>Mini CRM</span>
        </div>
        <button
          className="hamburger-btn"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
      <nav className={"sidebar-nav" + (open ? " open" : "")}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
