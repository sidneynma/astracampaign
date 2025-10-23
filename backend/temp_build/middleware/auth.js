"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMiddleware = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Token de acesso não fornecido'
            });
            return;
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('JWT_SECRET não configurado!');
            res.status(500).json({
                success: false,
                message: 'Erro de configuração do servidor'
            });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        // Verificar se o usuário ainda existe e está ativo
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!user || !user.ativo) {
            res.status(401).json({
                success: false,
                message: 'Usuário não encontrado ou inativo'
            });
            return;
        }
        // Adicionar dados do usuário à request
        req.user = {
            id: user.id,
            email: user.email,
            nome: user.nome,
            role: user.role,
            tenantId: decoded.tenantId
        };
        // Adicionar tenantId diretamente para fácil acesso
        req.tenantId = decoded.tenantId;
        // Se não é SUPERADMIN, buscar dados do tenant
        if (decoded.tenantId) {
            const tenant = await prisma.tenant.findUnique({
                where: {
                    id: decoded.tenantId,
                    active: true
                },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    active: true
                }
            });
            if (!tenant) {
                res.status(401).json({
                    success: false,
                    message: 'Tenant não encontrado ou inativo'
                });
                return;
            }
            req.tenant = tenant;
        }
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                success: false,
                message: 'Token expirado'
            });
            return;
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
            return;
        }
        console.error('Erro no middleware de autenticação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};
exports.authMiddleware = authMiddleware;
const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Usuário não autenticado'
        });
        return;
    }
    if (req.user.role !== 'ADMIN') {
        res.status(403).json({
            success: false,
            message: 'Acesso negado. Permissão de administrador necessária.'
        });
        return;
    }
    next();
};
exports.adminMiddleware = adminMiddleware;
