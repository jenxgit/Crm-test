import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import Dashboard from "./pages/Dashboard";
import CustomersList from "./pages/CustomersList";
import CustomerDetail from "./pages/CustomerDetail";
import ToursList from "./pages/ToursList";
import TourDetail from "./pages/TourDetail";
import TasksList from "./pages/TasksList";
import InvoicesList from "./pages/InvoicesList";
import InvoiceReceipt from "./pages/InvoiceReceipt";
import PaymentsList from "./pages/PaymentsList";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="customers" element={<CustomersList />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="tours" element={<ToursList />} />
          <Route path="tours/:id" element={<TourDetail />} />
          <Route path="invoices" element={<InvoicesList />} />
          <Route path="invoices/:id" element={<InvoiceReceipt />} />
          <Route path="payments" element={<PaymentsList />} />
          <Route path="tasks" element={<TasksList />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
