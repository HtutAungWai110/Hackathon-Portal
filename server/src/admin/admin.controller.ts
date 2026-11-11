import { Controller, Get } from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';

/**
 * A real admin route, used to prove that @Roles works against an
 * application controller. The admin plugin's own /auth/admin routes are
 * enforced inside the auth handler instead.
 */
@Controller('admin')
export class AdminController {
  @Get('ping')
  @Roles(['admin'])
  ping(): { ok: true } {
    return { ok: true };
  }
}
