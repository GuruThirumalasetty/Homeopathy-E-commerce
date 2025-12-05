import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role } from '../../core/models/user';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-roles.html',
  styleUrl: './admin-roles.scss'
})
export class AdminRolesComponent {
  private readonly api = inject(ApiService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  roles: Role[] = [];

  ngOnInit() {
    this.loadRoles();
  }

  loadRoles() {
    this.api.getRolesWithPermissions().subscribe({
      next: (roles) => {
        this.roles = roles;
      },
      error: () => {
        this.notifications.notify('Failed to load roles', 'error');
      }
    });
  }

  editRole(role: Role) {
    this.router.navigate(['/admin/roles', role.id, 'edit']);
  }

  deleteRole(role: Role) {
    if (confirm(`Are you sure you want to delete the role "${role.name}"? This action cannot be undone.`)) {
      this.api.deleteRole(role.id).subscribe({
        next: () => {
          this.notifications.notify('Role deleted successfully', 'success');
          this.loadRoles();
        },
        error: () => {
          this.notifications.notify('Failed to delete role', 'error');
        }
      });
    }
  }
}