export function ContactFormTest() {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Teste - Novo Contato</h2>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="">Selecione uma categoria</option>
              <option value="1">Cliente</option>
              <option value="2">Fornecedor</option>
              <option value="3">Lead</option>
              <option value="4">VIP</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md">
              Salvar
            </button>
            <button type="button" className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}