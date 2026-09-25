import { Router } from 'express'
import { accessRequestController } from '../controllers/accessRequestController'
import { authMiddleware } from '../middleware/authMiddleware'

const router = Router()

router.use(authMiddleware)

router.get('/', accessRequestController.listIncoming)
router.post('/:requestId/approve', accessRequestController.approve)
router.post('/:requestId/deny', accessRequestController.deny)

export default router
