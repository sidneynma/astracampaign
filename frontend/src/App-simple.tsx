import { useState } from 'react';
import { Toaster } from 'react-hot-toast';

function App() {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const handleOpenCategoryModal = () => {
    setIsCategoryModalOpen(true);
  };

  const handleCloseCategoryModal = () => {
    setIsCategoryModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Painel de Contatos</h1>
            <div className="flex gap-3">
              <button
                onClick={handleOpenCategoryModal}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                aria-label="Gerenciar categorias"
              >
                Gerenciar Categorias
              </button>
              <button
                onClick={() => alert('Novo Contato')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Criar novo contato"
              >
                Novo Contato
              </button>
            </div>
          </div>
        </header>

        <main>
          <div className="bg-white rounded-lg shadow p-6">
            <p>Painel de contatos funcionando!</p>
          </div>
        </main>

        {isCategoryModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Modal de Categorias</h2>
              <p className="mb-4">Modal funcionando!</p>
              <button
                onClick={handleCloseCategoryModal}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>

      <Toaster />
    </div>
  );
}

export default App;