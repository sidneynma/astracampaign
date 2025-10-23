import { useState } from 'react';
import { Category } from '../types';

interface CategoryListProps {
  categories: Category[];
  loading: boolean;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

export function CategoryList({ categories, loading, onEdit, onDelete }: CategoryListProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      onDelete(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label="Carregando categorias">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando...</span>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Nenhuma categoria encontrada.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200" role="table">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cor
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nome
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Descrição
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Atualizado em
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {categories.map((category) => (
            <tr key={category.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                {category.id}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div
                  className="w-6 h-6 rounded-full border border-gray-300"
                  style={{ backgroundColor: category.cor }}
                  aria-label={`Cor da categoria: ${category.cor}`}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {category.nome}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {category.descricao || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(category.atualizadoEm)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(category)}
                    className="text-blue-600 hover:text-blue-900 focus:outline-none focus:underline"
                    aria-label={`Editar categoria ${category.nome}`}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className={`focus:outline-none focus:underline ${
                      deleteConfirm === category.id
                        ? 'text-red-800 font-semibold'
                        : 'text-red-600 hover:text-red-900'
                    }`}
                    aria-label={
                      deleteConfirm === category.id
                        ? `Confirmar exclusão de ${category.nome}`
                        : `Excluir categoria ${category.nome}`
                    }
                  >
                    {deleteConfirm === category.id ? 'Confirmar?' : 'Excluir'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}