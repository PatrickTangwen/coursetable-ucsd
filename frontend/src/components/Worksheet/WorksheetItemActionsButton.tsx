import React, { useState, useRef } from 'react';
import {
  Overlay,
  Popover,
  Tooltip,
  OverlayTrigger,
  Modal,
  Button,
} from 'react-bootstrap';
import { FaEllipsisH } from 'react-icons/fa';
import { MdEdit } from 'react-icons/md';
import chroma from 'chroma-js';
import { Calendar } from 'react-big-calendar';
import { HexColorPicker } from 'react-colorful';
import { useShallow } from 'zustand/react/shallow';
import { CalendarEventBody, useEventStyle } from './CalendarEvent';
import { useStore } from '../../store';
import { type CourseRBCEvent, localizer } from '../../utilities/calendar';
import { worksheetColors } from '../../utilities/constants';
import { SurfaceComponent, Input } from '../Typography';
import styles from './ColorPickerButton.module.css';

function WorksheetItemActionsButton({
  event,
  className,
}: {
  readonly event: CourseRBCEvent;
  readonly className?: string;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const targetRef = useRef<HTMLButtonElement>(null);

  const setOpenColorPickerEvent = useStore(
    (state) => state.setOpenColorPickerEvent,
  );

  const togglePopover = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPopoverOpen((prev) => !prev);
  };

  const closePopover = () => {
    setPopoverOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={className}
        ref={targetRef}
        onClick={togglePopover}
        aria-label="Item actions"
      >
        <FaEllipsisH color="var(--color-text-dark)" />
      </button>
      <Overlay
        target={targetRef}
        show={popoverOpen}
        placement="bottom"
        containerPadding={20}
        rootClose
        onHide={closePopover}
      >
        {(props) => (
          <Popover id="popover-contained" {...props}>
            <Popover.Body>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <OverlayTrigger
                  placement="bottom"
                  overlay={
                    <Tooltip
                      id={`worksheet-item-color-${event.listing.crn}-${event.start.getTime()}-tooltip`}
                    >
                      <small>Change color</small>
                    </Tooltip>
                  }
                >
                  <button
                    type="button"
                    className={className}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenColorPickerEvent(event);
                      setPopoverOpen(false);
                    }}
                    aria-label="Change color"
                  >
                    <MdEdit color="var(--color-text-dark)" />
                  </button>
                </OverlayTrigger>
              </div>
            </Popover.Body>
          </Popover>
        )}
      </Overlay>
    </div>
  );
}

export function ColorPickerModal({
  onClose,
}: {
  readonly onClose: () => void;
}) {
  const {
    openColorPickerEvent,
    isAnonymousWorksheet,
    user,
    setAnonymousWorksheetListingColor,
    setActiveSavedWorksheetListingColor,
  } = useStore(
    useShallow((state) => ({
      openColorPickerEvent: state.openColorPickerEvent,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      user: state.user,
      setAnonymousWorksheetListingColor:
        state.setAnonymousWorksheetListingColor,
      setActiveSavedWorksheetListingColor:
        state.setActiveSavedWorksheetListingColor,
    })),
  );
  const [newColor, setNewColor] = useState<string | undefined>(undefined);

  if (!openColorPickerEvent) return null;

  const handleClose = () => {
    setNewColor(undefined);
    onClose();
  };

  return (
    <Modal show onHide={handleClose} centered>
      <Modal.Body className={styles.modalBody}>
        <Picker
          color={newColor ?? openColorPickerEvent.color}
          setColor={setNewColor}
        />
        <Preview
          event={openColorPickerEvent}
          color={newColor ?? openColorPickerEvent.color}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        <Button
          variant="primary"
          onClick={async () => {
            if (isAnonymousWorksheet) {
              setAnonymousWorksheetListingColor(
                openColorPickerEvent.listing,
                newColor ?? openColorPickerEvent.color,
              );
              onClose();
              return;
            }
            if (user) {
              await setActiveSavedWorksheetListingColor(
                openColorPickerEvent.listing,
                newColor ?? openColorPickerEvent.color,
              );
              onClose();
              return;
            }
            onClose();
          }}
        >
          Save changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function ColorInput({
  color,
  setColor,
}: {
  readonly color: string;
  readonly setColor: (newColor: string) => void;
}) {
  const [invalid, setInvalid] = useState(false);
  const [value, setValue] = useState(color);
  const [prevColor, setPrevColor] = useState(color);
  if (color !== prevColor) {
    setValue(color);
    setPrevColor(color);
  }
  return (
    <Input
      type="text"
      value={value}
      isInvalid={invalid}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        if (chroma.valid(newColor)) {
          setColor(newColor);
          setInvalid(false);
        } else {
          setInvalid(true);
        }
        setValue(newColor);
      }}
    />
  );
}

function Picker({
  color,
  setColor,
}: {
  readonly color: string;
  readonly setColor: (newColor: string) => void;
}) {
  return (
    <div className={styles.pickerPanel}>
      <ColorInput color={color} setColor={setColor} />
      <HexColorPicker color={color} onChange={setColor} />
      <div className={styles.presetColors}>
        {worksheetColors.map((presetColor) => (
          <button
            type="button"
            key={presetColor}
            className={styles.presetColor}
            style={{ background: presetColor }}
            onClick={() => {
              setColor(presetColor);
            }}
            aria-label={`Set color to ${presetColor}`}
          />
        ))}
      </div>
    </div>
  );
}

function Preview({
  event,
  color,
}: {
  readonly event: CourseRBCEvent;
  readonly color: string;
}) {
  const eventStyleGetter = useEventStyle();
  const tempEvent = { ...event, color };

  const start = new Date(tempEvent.start);
  if (start.getMinutes() === 0) start.setHours(start.getHours() - 1);
  start.setMinutes(0);

  const end = new Date(tempEvent.end);
  end.setHours(end.getHours() + 1);
  end.setMinutes(0);

  return (
    <SurfaceComponent className={styles.eventPreview}>
      <Calendar
        defaultView="day"
        views={['day']}
        events={[tempEvent]}
        date={tempEvent.start}
        min={start}
        max={end}
        localizer={localizer}
        toolbar={false}
        components={{ event: CalendarEventBody }}
        eventPropGetter={eventStyleGetter}
        tooltipAccessor={undefined}
        onNavigate={() => {}}
      />
    </SurfaceComponent>
  );
}

export default WorksheetItemActionsButton;
