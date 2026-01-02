// server.js - API REST para Habit Tracker
require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.resolve(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve arquivos estáticos (index.html)

// ================ FUNÇÕES DE MANIPULAÇÃO DO ARQUIVO ================

// Garantir que o arquivo data.json existe
async function ensureDataFile() {
    try {
        await fs.access(DATA_FILE);
        console.log('Arquivo data.json encontrado');
    } catch (error) {
        console.log('Criando arquivo data.json com estrutura inicial...');
        const initialData = {
            habits: [
                {
                    id: 1,
                    name: "Beber água",
                    description: "2 litros por dia",
                    frequency: "daily",
                    time: "morning",
                    completedToday: true,
                    streak: 7,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 2,
                    name: "Exercitar",
                    description: "30 minutos de atividade",
                    frequency: "daily",
                    time: "evening",
                    completedToday: false,
                    streak: 5,
                    createdAt: new Date().toISOString()
                }
            ],
            completions: {},
            lastUpdated: new Date().toISOString(),
            version: "1.0"
        };
        await saveDataToFile(initialData);
    }
}

// Ler dados do arquivo
async function readDataFromFile() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao ler arquivo:', error);
        return { habits: [], completions: {}, lastUpdated: new Date().toISOString(), version: "1.0" };
    }
}

// Salvar dados no arquivo
async function saveDataToFile(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        console.log('Dados salvos em data.json');
        return true;
    } catch (error) {
        console.error('Erro ao salvar arquivo:', error);
        return false;
    }
}

// Gerar novo ID único
function generateId() {
    return Date.now();
}

// ================ ROTAS DA API ================

// 1. GET /api/habits - Obter todos os hábitos
app.get('/api/habits', async (req, res) => {
    try {
        const data = await readDataFromFile();
        res.json({
            success: true,
            habits: data.habits,
            completions: data.completions,
            lastUpdated: data.lastUpdated,
            total: data.habits.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao carregar hábitos'
        });
    }
});

// 2. POST /api/habits - Criar novo hábito
app.post('/api/habits', async (req, res) => {
    try {
        const { name, description, frequency, time } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Nome do hábito é obrigatório'
            });
        }
        
        const data = await readDataFromFile();
        
        const newHabit = {
            id: generateId(),
            name,
            description: description || '',
            frequency: frequency || 'daily',
            time: time || 'anytime',
            completedToday: false,
            streak: 0,
            createdAt: new Date().toISOString()
        };
        
        data.habits.push(newHabit);
        
        const saved = await saveDataToFile(data);
        
        if (saved) {
            res.status(201).json({
                success: true,
                message: 'Hábito criado com sucesso',
                habit: newHabit,
                total: data.habits.length
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Erro ao salvar hábito'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// 3. PUT /api/habits/:id - Atualizar hábito
app.put('/api/habits/:id', async (req, res) => {
    try {
        const habitId = parseInt(req.params.id);
        const updates = req.body;
        
        const data = await readDataFromFile();
        const habitIndex = data.habits.findIndex(h => h.id === habitId);
        
        if (habitIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Hábito não encontrado'
            });
        }
        
        // Atualizar apenas campos permitidos
        const allowedFields = ['name', 'description', 'frequency', 'time', 'completedToday', 'streak'];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                data.habits[habitIndex][field] = updates[field];
            }
        });
        
        const saved = await saveDataToFile(data);
        
        if (saved) {
            res.json({
                success: true,
                message: 'Hábito atualizado com sucesso',
                habit: data.habits[habitIndex]
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Erro ao salvar alterações'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// 4. PATCH /api/habits/:id/toggle - Alternar status de completude
app.patch('/api/habits/:id/toggle', async (req, res) => {
    try {
        const habitId = parseInt(req.params.id);
        
        const data = await readDataFromFile();
        const habitIndex = data.habits.findIndex(h => h.id === habitId);
        
        if (habitIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Hábito não encontrado'
            });
        }
        
        const habit = data.habits[habitIndex];
        habit.completedToday = !habit.completedToday;
        
        if (habit.completedToday) {
            habit.streak++;
        } else {
            habit.streak = Math.max(0, habit.streak - 1);
        }
        
        const saved = await saveDataToFile(data);
        
        if (saved) {
            res.json({
                success: true,
                message: `Hábito ${habit.completedToday ? 'completado' : 'desmarcado'}`,
                habit: habit
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Erro ao salvar alterações'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// 5. DELETE /api/habits/:id - Excluir hábito
app.delete('/api/habits/:id', async (req, res) => {
    try {
        const habitId = parseInt(req.params.id);
        
        const data = await readDataFromFile();
        const initialLength = data.habits.length;
        
        data.habits = data.habits.filter(h => h.id !== habitId);
        
        if (data.habits.length === initialLength) {
            return res.status(404).json({
                success: false,
                error: 'Hábito não encontrado'
            });
        }
        
        const saved = await saveDataToFile(data);
        
        if (saved) {
            res.json({
                success: true,
                message: 'Hábito excluído com sucesso',
                total: data.habits.length
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Erro ao salvar alterações'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// 6. GET /api/stats - Obter estatísticas
app.get('/api/stats', async (req, res) => {
    try {
        const data = await readDataFromFile();
        const habits = data.habits;
        
        const totalHabits = habits.length;
        const completedToday = habits.filter(h => h.completedToday).length;
        const totalStreak = habits.reduce((sum, h) => sum + h.streak, 0);
        
        let successRate = 0;
        if (totalHabits > 0) {
            const avgStreak = totalStreak / totalHabits;
            successRate = Math.min(100, Math.round((avgStreak / 30) * 100));
        }
        
        res.json({
            success: true,
            stats: {
                totalHabits,
                completedToday,
                totalStreak,
                successRate,
                lastUpdated: data.lastUpdated
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao carregar estatísticas'
        });
    }
});

// 7. POST /api/backup - Criar backup
app.post('/api/backup', async (req, res) => {
    try {
        const data = await readDataFromFile();
        const backupFile = path.resolve(__dirname, `backup-${Date.now()}.json`);
        
        await fs.writeFile(backupFile, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: 'Backup criado com sucesso',
            backupFile: path.basename(backupFile)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao criar backup'
        });
    }
});

// 8. GET /api/export - Exportar dados (download)
app.get('/api/export', async (req, res) => {
    try {
        const data = await readDataFromFile();
        const filename = `habits-export-${new Date().toISOString().split('T')[0]}.json`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(data, null, 2));
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao exportar dados'
        });
    }
});

// 9. POST /api/import - Importar dados
app.post('/api/import', async (req, res) => {
    try {
        const importedData = req.body;
        
        if (!importedData.habits || !Array.isArray(importedData.habits)) {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos: deve conter array "habits"'
            });
        }
        
        // Validar e limpar dados
        const validatedHabits = importedData.habits.map(habit => ({
            id: habit.id || generateId(),
            name: habit.name || 'Hábito sem nome',
            description: habit.description || '',
            frequency: habit.frequency || 'daily',
            time: habit.time || 'anytime',
            completedToday: Boolean(habit.completedToday),
            streak: Math.max(0, parseInt(habit.streak) || 0),
            createdAt: habit.createdAt || new Date().toISOString()
        }));
        
        const data = {
            habits: validatedHabits,
            completions: importedData.completions || {},
            lastUpdated: new Date().toISOString(),
            version: "1.0"
        };
        
        const saved = await saveDataToFile(data);
        
        if (saved) {
            res.json({
                success: true,
                message: 'Dados importados com sucesso',
                total: data.habits.length
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Erro ao salvar dados importados'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao importar dados'
        });
    }
});

// 10. Rota raiz - Servir interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ================ INICIALIZAÇÃO DO SERVIDOR ================

async function startServer() {
    try {
        // Garantir que o arquivo data.json existe
        await ensureDataFile();
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
            console.log(`📁 Dados armazenados em: ${DATA_FILE}`);
            console.log(`📊 API disponível em: http://localhost:${PORT}/api/habits`);
            console.log(`🌐 Interface disponível em: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

// Iniciar o servidor
startServer();

// Exportar para testes (opcional)
module.exports = { app, ensureDataFile, readDataFromFile, saveDataToFile };