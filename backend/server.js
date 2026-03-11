const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ========================================
// SERVIR FRONTEND
// ========================================
app.use(express.static(path.join(__dirname, "../public")));

// ========================================
// ROTA PRINCIPAL
// ========================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ========================================
// SUPABASE
// ========================================
const supabase = createClient(
  process.env.SUPABASE_URL || "https://kckbcjjgbipcqzkynwpy.supabase.co",
  process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2JjampnYmlwY3F6a3lud3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDIxMjgsImV4cCI6MjA4ODMxODEyOH0.h3Z8LkzH_PXxE-BBHPii3WUwfHQH5HESsvzHUHKY7ZE"
);

// ========================================
// FUNÇÕES DE APOIO
// ========================================

// Função que verifica se dois intervalos [inicio,fim] se sobrepõem
function intervalosConflitam(inicioA, fimA, inicioB, fimB) {
  return !(fimA <= inicioB || fimB <= inicioA);
}

// Verifica conflito de horário para um profissional, considerando
// agendamentos e a tabela "bloqueios".
// Retorna { conflito: boolean, origem: 'agendamento' | 'bloqueio' | null }
async function existeConflitoHorario({ profissional, inicio, fim, ignorarId = null }) {
  const inicioISO = new Date(inicio).toISOString();
  const fimISO = new Date(fim).toISOString();

  // 1) Agendamentos do mesmo profissional (campo de texto "profissional")
  let { data: ags, error: agsError } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("profissional", profissional)
    .in("status", '("agendado","confirmado","em_andamento")');

  if (agsError) {
    console.error("Erro ao buscar agendamentos para conflito:", agsError);
    throw agsError;
  }

  if (ignorarId !== null) {
    ags = ags.filter((a) => a.id !== ignorarId);
  }

  const conflitoAg = (ags || []).some((a) =>
    intervalosConflitam(
      new Date(a.inicio).toISOString(),
      new Date(a.fim).toISOString(),
      inicioISO,
      fimISO
    )
  );

  if (conflitoAg) {
    return { conflito: true, origem: "agendamento" };
  }

  // 2) Bloqueios: profissional_id inteiro + bloqueios gerais (profissional_id null)
  try {
    let profissionalId = null;

    if (profissional) {
      const { data: profRow, error: profErr } = await supabase
        .from("profissionais")
        .select("id")
        .eq("nome", profissional)
        .single();

      if (!profErr && profRow) {
        profissionalId = profRow.id;
      }
    }

    let blqQuery = supabase.from("bloqueios").select("*");

    if (profissionalId !== null) {
      blqQuery = blqQuery.or(
        `profissional_id.eq.${profissionalId},profissional_id.is.null`
      );
    } else {
      blqQuery = blqQuery.is("profissional_id", null);
    }

    const { data: blqs, error: blqError } = await blqQuery;

    if (blqError) {
      console.warn("Erro ao buscar bloqueios:", blqError.message);
      return { conflito: false, origem: null };
    }

    const conflitoBlq = (blqs || []).some((b) =>
      intervalosConflitam(
        new Date(b.inicio).toISOString(),
        new Date(b.fim).toISOString(),
        inicioISO,
        fimISO
      )
    );

    if (conflitoBlq) {
      return { conflito: true, origem: "bloqueio" };
    }
  } catch (e) {
    console.warn("Exceção ao checar bloqueios:", e.message);
  }

  return { conflito: false, origem: null };
}

// ========================================
// CLIENTES
// ========================================
app.get("/clientes", async (req, res) => {
  const { data, error } = await supabase.from("clientes").select("*");
  if (error) return res.status(500).json(error);
  res.json(data);
});

app.post("/clientes", async (req, res) => {
  const { nome, telefone, email, endereco, observacoes } = req.body;
  if (!nome) return res.status(400).json({ message: "Nome é obrigatório" });

  const { data, error } = await supabase
    .from("clientes")
    .insert([{ nome, telefone, email, endereco, observacoes }])
    .select()
    .single();

  if (error) return res.status(500).json(error);
  res.status(201).json(data);
});

app.put("/clientes/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, telefone, email, endereco, observacoes } = req.body;

  const { data, error } = await supabase
    .from("clientes")
    .update({ nome, telefone, email, endereco, observacoes })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json(error);
  if (!data) return res.status(404).json({ message: "Cliente não encontrado" });
  res.json(data);
});

app.delete("/clientes/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);
  res.status(204).send();
});

// ========================================
// SERVIÇOS
// ========================================
app.get("/servicos", async (req, res) => {
  const { data, error } = await supabase.from("servicos").select("*");
  if (error) return res.status(500).json(error);

  // Normaliza para sempre ter campo "duracao"
  const normalizados = data.map((s) => ({
    ...s,
    duracao: s.duracao ?? s.duracao_minutos ?? s.duracaoMinutos ?? null,
  }));

  res.json(normalizados);
});

app.post("/servicos", async (req, res) => {
  const { nome, duracao, duracao_minutos, valor } = req.body;

  if (!nome) return res.status(400).json({ message: "Nome é obrigatório" });

  // aceita tanto "duracao" quanto "duracao_minutos"
  const duracaoFinal = duracao ?? duracao_minutos;
  if (!duracaoFinal) {
    return res.status(400).json({ message: "Duração é obrigatória" });
  }

  const { data, error } = await supabase
    .from("servicos")
    .insert([{ nome, duracao: duracaoFinal, duracao_minutos: duracaoFinal, valor }])
    .select()
    .single();

  if (error) return res.status(500).json(error);
  res.status(201).json(data);
});

app.put("/servicos/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, duracao, duracao_minutos, valor } = req.body;

  const duracaoFinal = duracao ?? duracao_minutos;

  const { data, error } = await supabase
    .from("servicos")
    .update({ nome, duracao: duracaoFinal, duracao_minutos: duracaoFinal, valor })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json(error);
  if (!data) return res.status(404).json({ message: "Serviço não encontrado" });
  res.json(data);
});

app.delete("/servicos/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("servicos")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);
  res.status(204).send();
});

// ========================================
// PROFISSIONAIS
// ========================================
app.get("/profissionais", async (req, res) => {
  const { data, error } = await supabase.from("profissionais").select("*");
  if (error) return res.status(500).json(error);
  res.json(data);
});

app.post("/profissionais", async (req, res) => {
  const { nome, telefone, especialidade, cor_calendario } = req.body;
  if (!nome) return res.status(400).json({ message: "Nome é obrigatório" });

  const { data, error } = await supabase
    .from("profissionais")
    .insert([{ nome, telefone, especialidade, cor_calendario }])
    .select()
    .single();

  if (error) return res.status(500).json(error);
  res.status(201).json(data);
});

app.put("/profissionais/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, telefone, especialidade, cor_calendario } = req.body;

  const { data, error } = await supabase
    .from("profissionais")
    .update({ nome, telefone, especialidade, cor_calendario })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json(error);
  if (!data) return res.status(404).json({ message: "Profissional não encontrado" });
  res.json(data);
});

app.delete("/profissionais/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("profissionais")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);
  res.status(204).send();
});

// ========================================
// AGENDAMENTOS
// ========================================

// Lista agendamentos
app.get("/agendamentos", async (req, res) => {
  const { data, error } = await supabase.from("agendamentos").select("*");
  if (error) return res.status(500).json(error);
  res.json(data);
});

// Cria agendamento com checagem de conflito
app.post("/agendamentos", async (req, res) => {
  const { cliente, servico, profissional, observacoes, inicio, fim, status = "agendado" } = req.body;

  if (!cliente || !servico || !profissional || !inicio || !fim) {
    return res.status(400).json({
      message: "Campos obrigatórios: cliente, servico, profissional, inicio, fim",
    });
  }

  try {
    const { conflito, origem } = await existeConflitoHorario({
      profissional,
      inicio,
      fim,
    });
    if (conflito) {
      const mensagem =
        origem === "bloqueio"
          ? "Este horário está bloqueado."
          : "Conflito de horário para este profissional.";
      return res.status(409).json({ message: mensagem });
    }

    const { data, error } = await supabase
      .from("agendamentos")
      .insert([{ cliente, servico, profissional, observacoes, inicio, fim, status }])
      .select()
      .single();

    if (error) return res.status(500).json(error);
    res.status(201).json(data);
  } catch (e) {
    console.error("Erro ao criar agendamento:", e);
    res.status(500).json({ message: "Erro ao criar agendamento." });
  }
});

// Atualiza agendamento (inclusive troca de profissional) com checagem de conflito
app.put("/agendamentos/:id", async (req, res) => {
  const { id } = req.params;
  const { cliente, servico, profissional, observacoes, inicio, fim, status } = req.body;

  const { data: atual, error: erroBusca } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("id", id)
    .single();

  if (erroBusca || !atual) {
    return res.status(404).json({ message: "Agendamento não encontrado." });
  }

  const profissionalFinal = profissional ?? atual.profissional;
  const inicioFinal = inicio ?? atual.inicio;
  const fimFinal = fim ?? atual.fim;

  try {
    const { conflito, origem } = await existeConflitoHorario({
      profissional: profissionalFinal,
      inicio: inicioFinal,
      fim: fimFinal,
      ignorarId: atual.id,
    });

    if (conflito) {
      const mensagem =
        origem === "bloqueio"
          ? "Este horário está bloqueado."
          : "Conflito de horário para este profissional.";
      return res.status(409).json({ message: mensagem });
    }

    const { data, error } = await supabase
      .from("agendamentos")
      .update({
        cliente: cliente ?? atual.cliente,
        servico: servico ?? atual.servico,
        profissional: profissionalFinal,
        observacoes: observacoes ?? atual.observacoes,
        inicio: inicioFinal,
        fim: fimFinal,
        status: status ?? atual.status
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json(error);
    res.json(data);
  } catch (e) {
    console.error("Erro ao atualizar agendamento:", e);
    res.status(500).json({ message: "Erro ao atualizar agendamento." });
  }
});

// Exclui agendamento
app.delete("/agendamentos/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from("agendamentos").delete().eq("id", id);
  if (error) return res.status(500).json(error);

  res.status(204).send();
});

// Histórico de agendamentos do cliente
app.get("/clientes/:nome/historico", async (req, res) => {
  const { nome } = req.params;
  
  try {
    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("cliente", nome)
      .order("inicio", { ascending: false });

    if (error) return res.status(500).json(error);
    res.json(data);
  } catch (e) {
    console.error("Erro ao buscar histórico do cliente:", e);
    res.status(500).json({ message: "Erro ao buscar histórico." });
  }
});

// ========================================
// BLOQUEIOS
// ========================================
// Tabela "bloqueios": id (uuid), salon_id (uuid), profissional_id (integer, nullable),
// titulo (text), motivo (text), inicio (timestamp), fim (timestamp), tipo (text), criado_em (timestamp)
app.get("/bloqueios", async (req, res) => {
  try {
    const { data, error } = await supabase.from("bloqueios").select("*");
    if (error) {
      console.warn("Erro ao listar bloqueios:", error.message);
      return res.json([]);
    }
    res.json(data);
  } catch (e) {
    console.warn("Exceção ao listar bloqueios:", e.message);
    res.json([]);
  }
});

app.post("/bloqueios", async (req, res) => {
  const { profissional_id, titulo, motivo, inicio, fim, tipo, salon_id } = req.body;

  if (!titulo || !inicio || !fim || !tipo) {
    return res
      .status(400)
      .json({ message: "Campos obrigatórios: titulo, inicio, fim e tipo" });
  }

  try {
    const { data, error } = await supabase
      .from("bloqueios")
      .insert([
        {
          profissional_id: profissional_id ?? null,
          titulo,
          motivo: motivo ?? null,
          inicio,
          fim,
          tipo,
          salon_id: salon_id ?? null,
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json(error);
    res.status(201).json(data);
  } catch (e) {
    console.error("Erro ao criar bloqueio:", e);
    res.status(500).json({ message: "Erro ao criar bloqueio." });
  }
});

// Atualiza bloqueio existente
app.put("/bloqueios/:id", async (req, res) => {
  const { id } = req.params;
  const { profissional_id, titulo, motivo, inicio, fim, tipo } = req.body;

  try {
    const { data, error } = await supabase
      .from("bloqueios")
      .update({
        profissional_id: profissional_id ?? null,
        titulo,
        motivo: motivo ?? null,
        inicio,
        fim,
        tipo,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json(error);
    res.json(data);
  } catch (e) {
    console.error("Erro ao atualizar bloqueio:", e);
    res.status(500).json({ message: "Erro ao atualizar bloqueio." });
  }
});

app.delete("/bloqueios/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from("bloqueios").delete().eq("id", id);
    if (error) return res.status(500).json(error);
    res.status(204).send();
  } catch (e) {
    console.error("Erro ao remover bloqueio:", e);
    res.status(500).json({ message: "Erro ao remover bloqueio." });
  }
});

// ========================================
// INICIAR SERVIDOR
// ========================================
app.listen(3000, () => {
  console.log("Servidor rodando em:");
  console.log("http://localhost:3000");
});