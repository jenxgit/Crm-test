import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Task } from "../lib/api";

export default function TasksList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.tasks
      .list()
      .then(setTasks)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (id: number) => {
    await api.tasks.remove(id);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1>Tasks</h1>
          <span className="muted">{tasks.length} open</span>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading&hellip;</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">No tasks yet. Add one from a customer's page.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Task</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/customers/${t.customerId}`}>
                      {t.firstName} {t.lastName}
                    </Link>
                  </td>
                  <td style={{ whiteSpace: "pre-line" }}>{t.task}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => remove(t.id)}>
                      Done
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
