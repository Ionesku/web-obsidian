import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderPlus } from 'lucide-react';

interface AddBookmarkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  path: string;
  defaultTitle: string;
  existingGroups: string[];
}

const AddBookmarkDialog: React.FC<AddBookmarkDialogProps> = ({ isOpen, onClose, onSuccess, path, defaultTitle, existingGroups }) => {
  const [title, setTitle] = useState(defaultTitle);
  const [group, setGroup] = useState('');
  const [showGroupList, setShowGroupList] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle);
      setGroup('');
    }
  }, [isOpen, defaultTitle]);

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

  const filteredGroups = existingGroups.filter(g => g.toLowerCase().includes(group.toLowerCase()));

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
            <Input type="text" value={path} readOnly disabled className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input type="text" value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div className="relative">
            <label className="text-sm font-medium">Bookmark group</label>
            <Input 
              type="text" 
              value={group} 
              onChange={e => setGroup(e.target.value)} 
              onFocus={() => setShowGroupList(true)}
              onBlur={() => setTimeout(() => setShowGroupList(false), 150)}
              placeholder="Select or create a group..."
              className="mt-1" 
            />
            {showGroupList && (
              <div className="absolute z-10 w-full bg-white dark:bg-card border rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                {filteredGroups.map(g => (
                  <div 
                    key={g} 
                    onMouseDown={() => {
                      setGroup(g);
                      setShowGroupList(false);
                    }}
                    className="px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-black/20 cursor-pointer"
                  >
                    {g}
                  </div>
                ))}
                {group && !existingGroups.includes(group) && (
                  <div 
                    onMouseDown={() => setShowGroupList(false)}
                    className="px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-black/20 cursor-pointer flex items-center gap-2"
                  >
                    <FolderPlus className="w-4 h-4" />
                    Create "{group}"
                  </div>
                )}
              </div>
            )}
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
