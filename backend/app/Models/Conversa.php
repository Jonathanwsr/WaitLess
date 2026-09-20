<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Conversa extends Model
{
    protected $guarded = [];

    public function usuario() {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function estabelecimento() {
        return $this->belongsTo(Estabelecimento::class, 'estabelecimento_id');
    }

    public function funcionario() {
        return $this->belongsTo(Funcionario::class, 'funcionario_id');
    }

    public function agendamento() {
        return $this->belongsTo(Agendamento::class, 'agendamento_id');
    }

    public function aluguel() {
        return $this->belongsTo(Aluguel::class, 'aluguel_id');
    }

    public function mensagens() {
        return $this->hasMany(Mensagem::class);
    }


    public function ultimaMensagem() {
        return $this->hasOne(Mensagem::class)->latestOfMany();
    }

    /**
     * Quantas mensagens desta conversa ainda não foram lidas pelo usuário
     * informado (ou seja, mandadas por outra pessoa e sem lida_em).
     */
    public function mensagensNaoLidasPara($userId): int
    {
        return $this->mensagens()
            ->where('remetente_id', '!=', $userId)
            ->whereNull('lida_em')
            ->count();
    }

    /**
     * IDs dos usuários que devem ser avisados (canal privado + sino) quando
     * $remetenteId manda uma mensagem nesta conversa: o outro lado do chat.
     * Cliente mandando -> avisa o funcionário responsável (se houver) e/ou
     * todo mundo vinculado ao estabelecimento; equipe mandando -> avisa o cliente.
     */
    public function usuariosParaNotificar(int $remetenteId): array
    {
        if ((int) $remetenteId === (int) $this->usuario_id) {
            if ($this->funcionario_id && $this->funcionario?->usuario_id) {
                return array_unique(array_filter([
                    (int) $this->funcionario->usuario_id,
                    ...DB::table('estabelecimento_usuario')
                        ->where('estabelecimento_id', $this->estabelecimento_id)
                        ->whereIn('tipo', ['admin', 'socio', 'proprietario', 'gerente'])
                        ->pluck('usuario_id')
                        ->all(),
                ]));
            }

            return DB::table('estabelecimento_usuario')
                ->where('estabelecimento_id', $this->estabelecimento_id)
                ->pluck('usuario_id')
                ->unique()
                ->values()
                ->all();
        }

        return [(int) $this->usuario_id];
    }
}
