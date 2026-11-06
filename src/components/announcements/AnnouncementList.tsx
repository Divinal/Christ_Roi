import React from 'react';
import { Bell } from 'lucide-react';
import { Announcement, PRIORITY_CLASSES, PRIORITY_LABELS } from '../../lib/announcements';
import { formatDate } from '../../lib/grades';
import { EmptyState } from '../ui/primitives';

const AnnouncementList: React.FC<{ announcements: Announcement[] }> = ({ announcements }) => {
  if (announcements.length === 0) {
    return <EmptyState icon={Bell} title="Aucune annonce pour le moment" />;
  }

  return (
    <ul className="space-y-3">
      {announcements.map((announcement) => (
        <li key={announcement.id} className="rounded-lg border p-4">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLASSES[announcement.priority]}`}>
              {PRIORITY_LABELS[announcement.priority]}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{announcement.content}</p>
          <p className="mt-2 text-xs text-gray-500">
            Publié le {formatDate(announcement.published_at)}
            {announcement.expires_at && ` • Expire le ${formatDate(announcement.expires_at)}`}
          </p>
        </li>
      ))}
    </ul>
  );
};

export default AnnouncementList;
