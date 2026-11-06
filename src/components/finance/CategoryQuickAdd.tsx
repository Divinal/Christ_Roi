import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { FinancialCategory, FinancialKind } from './financeTypes';
import { confirmDialog, notify } from '../ui/feedback';

interface CategoryQuickAddProps {
  kind: FinancialKind;
  categories: FinancialCategory[];
  onChanged: () => void;
}

const CategoryQuickAdd: React.FC<CategoryQuickAddProps> = ({ kind, categories, onChanged }) => {
  const [name, setName] = useState('');
  const [showList, setShowList] = useState(false);

  const relevantCategories = categories.filter((c) => c.kind === kind);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const { error } = await supabase.from('financial_categories').insert({
      kind,
      name: name.trim(),
    });

    if (error) {
      notify(`❌ Erreur: ${error.message}`);
    } else {
      setName('');
      onChanged();
    }
  };

  const handleDeactivate = async (categoryId: string) => {
    if (!await confirmDialog('Masquer cette catégorie ? Son historique sera conservé.')) return;
    const { error } = await supabase
      .from('financial_categories')
      .update({ is_active: false })
      .eq('id', categoryId);

    if (error) notify(`❌ Erreur: ${error.message}`);
    else onChanged();
  };

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'expense' ? 'Nouvelle catégorie de dépense' : 'Nouvelle catégorie de recette'}
            className="border rounded px-3 py-2 text-sm w-56"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-1 text-sm"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </form>
        <button
          onClick={() => setShowList(!showList)}
          className="text-sm text-blue-600 hover:underline"
        >
          {showList ? 'Masquer les catégories' : 'Gérer les catégories'}
        </button>
      </div>

      {showList && (
        <div className="mt-3 flex flex-wrap gap-2">
          {relevantCategories.map((cat) => (
            <span
              key={cat.id}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs ${
                cat.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400 line-through'
              }`}
            >
              {cat.name}
              {!cat.is_system && cat.is_active && (
                <button onClick={() => handleDeactivate(cat.id)} title="Masquer">
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryQuickAdd;
