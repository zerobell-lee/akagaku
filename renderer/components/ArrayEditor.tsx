import React from 'react';

interface ArrayEditorProps {
  items: any[];
  itemSchema: {
    type: string;
    fields?: { key: string; label: string; placeholder?: string }[];
  };
  onChange: (items: any[]) => void;
}

export const ArrayEditor: React.FC<ArrayEditorProps> = ({ items, itemSchema, onChange }) => {
  const addItem = () => {
    if (itemSchema.fields) {
      const newItem: any = {};
      itemSchema.fields.forEach(field => {
        newItem[field.key] = '';
      });
      onChange([...items, newItem]);
    } else {
      onChange([...items, '']);
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, key: string, value: any) => {
    const newItems = [...items];
    if (itemSchema.fields) {
      newItems[index] = { ...newItems[index], [key]: value };
    } else {
      newItems[index] = value;
    }
    onChange(newItems);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2 items-center">
          {itemSchema.fields ? (
            itemSchema.fields.map(field => (
              <input
                key={field.key}
                type="text"
                placeholder={field.placeholder || field.label}
                value={item[field.key] || ''}
                onChange={(e) => updateItem(index, field.key, e.target.value)}
                className="bg-gray-700 text-white px-3 py-2 rounded flex-1"
              />
            ))
          ) : (
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(index, '', e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded flex-1"
            />
          )}
          <button
            onClick={() => removeItem(index)}
            className="text-red-400 hover:text-red-300 px-2"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="text-blue-400 hover:text-blue-300 text-sm"
      >
        + Add Item
      </button>
    </div>
  );
};
