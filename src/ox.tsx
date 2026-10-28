// ox_lib UI building blocks: context menu, input dialog and text UI (web/src/features/{menu/context,dialog,textui}).
import type { ReactNode } from 'react';
import { Button, Group, Modal, Stack } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faChevronLeft, faChevronRight, type IconDefinition } from '@fortawesome/free-solid-svg-icons';

export function Menu({ title, onBack, children }: { title: string; onBack?: () => void; children: ReactNode }) {
  return (
    <div className="ctx">
      <div className="ctx-header">
        {onBack && (
          <button className="ctx-headbtn" onClick={onBack}>
            <FontAwesomeIcon icon={faChevronLeft} fontSize={16} fixedWidth />
          </button>
        )}
        <div className="ctx-title">{title}</div>
      </div>
      <div className="ctx-options" key={title}>{children}</div>
    </div>
  );
}

export function Option({ icon, iconColor, title, description, arrow, checked, onClick, disabled, readOnly }: {
  icon?: IconDefinition;
  iconColor?: string;
  title: ReactNode;
  description?: ReactNode;
  arrow?: boolean;
  checked?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  return (
    <button
      className={`ctx-btn${readOnly ? ' readonly' : ''}`}
      disabled={disabled}
      tabIndex={readOnly ? -1 : undefined}
      onClick={readOnly ? undefined : onClick}
    >
      <div className="ctx-main">
        <div className="ctx-row">
          {icon && (
            <span className="ctx-icon">
              <FontAwesomeIcon icon={icon} size="lg" fixedWidth style={{ color: iconColor }} />
            </span>
          )}
          <span className="ctx-label">{title}</span>
        </div>
        {description && <div className="ctx-desc">{description}</div>}
      </div>
      {(arrow || checked) && (
        <span className="ctx-arrow">
          <FontAwesomeIcon icon={checked ? faCheck : faChevronRight} fixedWidth />
        </span>
      )}
    </button>
  );
}

export function Dialog({ opened, heading, onCancel, onConfirm, cancelLabel, confirmLabel, confirmDisabled, children }: {
  opened: boolean;
  heading: string;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      centered
      size="xs"
      title={heading}
      withCloseButton={false}
      closeOnClickOutside={false}
      overlayProps={{ backgroundOpacity: 0.5 }}
      transitionProps={{ transition: 'fade', duration: 150 }}
      styles={{ title: { textAlign: 'center', width: '100%', fontSize: 18 } }}
    >
      <form onSubmit={(e) => { e.preventDefault(); if (!confirmDisabled) onConfirm(); }}>
        <Stack>
          {children}
          <Group justify="flex-end" gap={10}>
            <Button tt="uppercase" variant="default" onClick={onCancel} mr={3}>{cancelLabel}</Button>
            <Button tt="uppercase" variant="light" type="submit" disabled={confirmDisabled}>{confirmLabel}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function TextUI({ children }: { children: ReactNode }) {
  return <div className="textui">{children}</div>;
}
