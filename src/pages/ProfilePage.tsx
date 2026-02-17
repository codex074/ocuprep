import { useAuth } from '../contexts/AuthContext';
import ProfileCard from '../components/ProfileCard';

export default function ProfilePage() {
  const { user } = useAuth();
  
  if (!user) return null;

  return (
    <div className="page-section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '20px' }}>
      <ProfileCard targetUser={user} isOwnProfile={true} />
    </div>
  );
}
