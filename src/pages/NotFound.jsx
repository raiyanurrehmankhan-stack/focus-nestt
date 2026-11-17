import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export default function NotFound() {
  return (
    <div className="page card">
      <EmptyState mascot="loosening" title="This page flew away" message="The page you're looking for doesn't exist." action={<Link to="/" className="font-semibold text-teal">Back to dashboard</Link>} />
    </div>
  );
}
