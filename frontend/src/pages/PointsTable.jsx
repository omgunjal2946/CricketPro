import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ListOrdered } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import PointsTableView from '../components/PointsTableView.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import { PageLoader, ErrorState, EmptyState } from '../components/Feedback.jsx';
import useFetch from '../hooks/useFetch.js';
import usePolling from '../hooks/usePolling.js';
import { tournamentsApi } from '../services/api.js';

export default function PointsTable() {
  const tours = useFetch(() => tournamentsApi.list());
  const [picked, setId] = useState('');
  const list = tours.data || [];
  const id = picked || (list.length ? (list.find((t) => t.status === 'Ongoing') || list[0])._id : '');

  const pts = useFetch(() => (id ? tournamentsApi.points(id) : Promise.resolve(null)), [id]);
  usePolling(() => pts.reload(true), 15000, Boolean(id));

  if (tours.loading && !tours.data) return <PageLoader />;
  if (tours.error) return <ErrorState message={tours.error} onRetry={tours.reload} />;
  if (tours.data.length === 0) {
    return <><PageHeader title="Points Table" /><EmptyState icon={ListOrdered} title="No tournaments yet" text="Create a tournament and complete matches to build a points table." action={<Link className="btn btn-primary" to="/tournaments">Go to tournaments</Link>} /></>;
  }
  const p = pts.data;
  return (
    <>
      <PageHeader title="Points Table" subtitle="Updated automatically from completed matches"
        actions={<select aria-label="Choose tournament" value={id} onChange={(e) => setId(e.target.value)}>{tours.data.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select>} />
      {pts.loading && !p ? <PageLoader /> : pts.error ? <ErrorState message={pts.error} onRetry={pts.reload} /> : p && (
        <>
          <section className="card">
            <div className="card-head"><h2>{p.tournament.name}</h2><StatusBadge status={p.tournament.status} /></div>
            {p.table.length === 0 ? <p className="muted">This tournament has no teams.</p> : <PointsTableView table={p.table} />}
          </section>
          <section className="card rules">
            <h3>How the table is calculated</h3>
            <ul>
              <li>Win: 2 points. Tie: 1 point each. No result: 1 point each. Loss: 0 points.</li>
              <li>Teams are ranked by points, then net run rate, then wins.</li>
              <li>Net run rate = runs scored per over faced minus runs conceded per over bowled. A team bowled out is counted as having faced its full overs. No-result and Test matches are excluded.</li>
            </ul>
          </section>
        </>
      )}
    </>
  );
}
