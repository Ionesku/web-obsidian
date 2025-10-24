'use client';

/**
 * Template Management UI
 */
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { templatesDB, type Template } from '@/lib/db';
import {
  extractVariables,
  validateTemplate,
  getRequiredInputVariables,
} from '@/lib/templates';

interface TemplateManagerProps {
  onClose: () => void;
}

export function TemplateManager({ onClose }: TemplateManagerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTemplate, setEditedTemplate] = useState<Partial<Template>>({});

  // Get all templates
  const templates = useLiveQuery(() => templatesDB.getAllTemplates(), []);

  /**
   * Start editing template
   */
  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setEditedTemplate({ ...template });
    setIsEditing(true);
  };

  /**
   * Save template
   */
  const handleSave = async () => {
    if (!editedTemplate.name || !editedTemplate.content) {
      alert('Name and content are required');
      return;
    }

    const validation = validateTemplate(editedTemplate.content);
    if (!validation.valid) {
      alert(`Template validation failed:\n${validation.errors.join('\n')}`);
      return;
    }

    try {
      const variables = extractVariables(editedTemplate.content);
      await templatesDB.saveTemplate({
        ...editedTemplate,
        variables,
        type: editedTemplate.type || 'custom',
        isDefault: editedTemplate.isDefault || false,
      } as any);

      setIsEditing(false);
      setSelectedTemplate(null);
      setEditedTemplate({});
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  /**
   * Delete template
   */
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await templatesDB.deleteTemplate(id);
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  /**
   * Create new template
   */
  const handleCreateNew = () => {
    setEditedTemplate({
      name: 'New Template',
      type: 'custom',
      content: '# {{title}}\n\n',
      isDefault: false,
    });
    setSelectedTemplate(null);
    setIsEditing(true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Template Management</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              ➕ New Template
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Template List */}
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-bold text-sm text-gray-600 uppercase mb-3">
                Templates ({templates?.length || 0})
              </h3>

              <div className="space-y-2">
                {templates?.map((template) => (
                  <div
                    key={template.id}
                    className={`p-3 border rounded-lg cursor-pointer transition ${
                      selectedTemplate?.id === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setSelectedTemplate(template);
                      setIsEditing(false);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Type: {template.type}
                          {template.isDefault && ' • Default'}
                        </p>
                      </div>
                      {!template.isDefault && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(template.id!);
                          }}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {templates?.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No templates yet. Create one!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Template Preview/Edit */}
          <div className="flex-1 overflow-y-auto p-6">
            {isEditing ? (
              /* Edit Mode */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Template Name</label>
                  <input
                    type="text"
                    value={editedTemplate.name || ''}
                    onChange={(e) => setEditedTemplate({ ...editedTemplate, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <select
                    value={editedTemplate.type || 'custom'}
                    onChange={(e) =>
                      setEditedTemplate({
                        ...editedTemplate,
                        type: e.target.value as Template['type'],
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="meeting">Meeting</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Content
                    <span className="text-xs text-gray-500 ml-2">
                      Use {'{{variableName}}'} for variables
                    </span>
                  </label>
                  <textarea
                    value={editedTemplate.content || ''}
                    onChange={(e) =>
                      setEditedTemplate({ ...editedTemplate, content: e.target.value })
                    }
                    className="w-full h-96 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editedTemplate.isDefault || false}
                    onChange={(e) =>
                      setEditedTemplate({ ...editedTemplate, isDefault: e.target.checked })
                    }
                    disabled={selectedTemplate?.isDefault}
                    className="w-4 h-4"
                  />
                  <label className="text-sm">Set as default for this type</label>
                </div>

                {/* Variables Info */}
                {editedTemplate.content && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Variables detected:</h4>
                    <div className="flex flex-wrap gap-2">
                      {extractVariables(editedTemplate.content).map((variable, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-mono"
                        >
                          {'{{'}{variable}{'}}'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                  >
                    💾 Save Template
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedTemplate({});
                    }}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : selectedTemplate ? (
              /* Preview Mode */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">{selectedTemplate.name}</h3>
                  <button
                    onClick={() => handleEdit(selectedTemplate)}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                  >
                    ✏️ Edit
                  </button>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Type: <strong>{selectedTemplate.type}</strong></span>
                  {selectedTemplate.isDefault && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                      Default
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Variables:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.variables.map((variable, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono"
                      >
                        {'{{'}{variable}{'}}'}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Content Preview:</h4>
                  <pre className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm overflow-auto max-h-96">
                    {selectedTemplate.content}
                  </pre>
                </div>

                <div className="text-xs text-gray-500">
                  <p>Created: {new Date(selectedTemplate.createdAt).toLocaleString()}</p>
                  <p>Updated: {new Date(selectedTemplate.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            ) : (
              /* No Selection */
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="text-xl mb-4">Select a template to view or edit</p>
                  <p className="text-sm">Or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <h4 className="font-medium text-sm mb-2">Available Variables:</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <strong>Dates:</strong> {'{{date:YYYY-MM-DD}}'}, {'{{date:dddd, MMMM D, YYYY}}'}
            </div>
            <div>
              <strong>Times:</strong> {'{{time:HH:mm}}'}, {'{{time:hh:mm A}}'}
            </div>
            <div>
              <strong>Other:</strong> {'{{weekNumber}}'}, {'{{title}}'} (custom)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateManager;

