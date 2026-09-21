import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/customers", label: "Customers" },
  { to: "/tours", label: "Tours" },
  { to: "/tasks", label: "Tasks" },
];

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">M</div>
        <span>Mini CRM</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
