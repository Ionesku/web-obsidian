import React, { useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AddBookmarkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  path: string;
  defaultTitle: string;
}

const AddBookmarkDialog: React.FC<AddBookmarkDialogProps> = ({ isOpen, onClose, onSuccess, path, defaultTitle }) => {
  const [title, setTitle] = useState(defaultTitle);
  const [group, setGroup] = useState('');

  const handleSubmit = async () => {
    try {
      await api.createBookmark(path, title, group || undefined);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to create bookmark:', error);
      alert(`Error: ${error.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-white dark:bg-card border dark:border-border rounded-lg shadow-lg w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Add bookmark</h2>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Path</label>
            <Input type="text" value={path} readOnly disabled />
          </div>
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input type="text" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Bookmark group (optional)</label>
            <Input type="text" value={group} onChange={e => setGroup(e.target.value)} placeholder="e.g. Reading List" />
          </div>
        </div>
        <div className="p-4 flex justify-end gap-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Save</Button>
        </div>
      </div>
    </div>
  );
};

export default AddBookmarkDialog;
