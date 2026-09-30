import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { DocumentTextIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({ mustVerifyEmail, status }) {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Profile
                </h2>
            }
        >
            <Head title="Profile" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                            className="max-w-xl"
                        />
                    </div>

                    <div className="bg-white shadow sm:rounded-lg dark:bg-gray-800">
                        <Link
                            href={route('perfil.termos')}
                            className="flex items-center justify-between p-4 sm:p-8 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#FFF3EC] flex items-center justify-center shrink-0">
                                    <DocumentTextIcon className="w-5 h-5 text-[#FF5A00]" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-gray-100">Termos e Compromissos</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Consulte o termo que você aceitou e a data do aceite</p>
                                </div>
                            </div>
                            <ChevronRightIcon className="w-5 h-5 text-gray-400 shrink-0" />
                        </Link>
                    </div>

                    <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <UpdatePasswordForm className="max-w-xl" />
                    </div>

                    <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <DeleteUserForm className="max-w-xl" />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
