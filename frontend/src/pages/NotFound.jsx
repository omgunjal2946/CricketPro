import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { EmptyState } from '../components/Feedback.jsx';

export default function NotFound() {
  return <EmptyState icon={SearchX} title="Page not found" text="The page you are looking for does not exist." action={<Link className="btn btn-primary" to="/">Back to dashboard</Link>} />;
}
