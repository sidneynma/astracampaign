import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ContactInput, Contact } from '../types';
import { apiService } from '../services/api';
import { validatePhone } from '../utils/phoneUtils';

const contactSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: z.string().min(1, 'Telefone é obrigatório').refine(validatePhone, {
    message: 'Formato de telefone inválido',
  }),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  observacoes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  contact?: Contact;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContactForm({ contact, onSuccess, onCancel }: ContactFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nome: contact?.nome || '',
      telefone: contact?.telefone || '',
      email: contact?.email || '',
      observacoes: contact?.observacoes || '',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      const contactInput: ContactInput = {
        nome: data.nome,
        telefone: data.telefone,
        email: data.email || undefined,
        observacoes: data.observacoes || undefined,
      };

      if (contact) {
        await apiService.updateContact(contact.id, contactInput);
        toast.success('Contato atualizado com sucesso');
      } else {
        await apiService.createContact(contactInput);
        toast.success('Contato criado com sucesso');
      }

      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar contato';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md" role="dialog" aria-labelledby="form-title">
        <h2 id="form-title" className="text-xl font-semibold mb-4">
          {contact ? 'Editar Contato' : 'Novo Contato'}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
              Nome *
            </label>
            <input
              id="nome"
              type="text"
              {...register('nome')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.nome && (
              <p className="text-red-500 text-sm mt-1">
                {errors.nome.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="telefone" className="block text-sm font-medium text-gray-700 mb-1">
              Telefone *
            </label>
            <input
              id="telefone"
              type="tel"
              {...register('telefone')}
              placeholder="+55 11 99999-9999"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.telefone && (
              <p className="text-red-500 text-sm mt-1">
                {errors.telefone.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>


          <div>
            <label htmlFor="observacoes" className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              id="observacoes"
              {...register('observacoes')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}