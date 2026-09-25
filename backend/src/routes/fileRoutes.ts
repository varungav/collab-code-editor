import { Router } from 'express'
import { fileController } from '../controllers/fileController'
import { authMiddleware } from '../middleware/authMiddleware'

const router = Router()

router.use(authMiddleware)

router.get('/:fileId', fileController.getOne)
router.put('/:fileId', fileController.update)
router.delete('/:fileId', fileController.remove)

export default router
