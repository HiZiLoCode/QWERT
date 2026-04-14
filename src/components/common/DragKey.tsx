'use client';

// import { AddIcon } from "@chakra-ui/icons";
// import { div, Button, Image } from "@chakra-ui/react";
import { Button, Image } from "element-react";
import { useEffect, useMemo, useState } from "react";
import Draggable from "react-draggable";


function DragKey({dksKey, onChange}) {

    const [position, setPosition] = useState({downStart: 0, downEnd: 0, upStart: 0})
    const [newPosition, setNewPosition] = useState({downStart: 0, downEnd: 0, upStart: 0})

    const [dragItem, setDragItem] = useState('');

    const dks = useMemo(() => {
        const {downStart, downEnd, upStart} = dksKey;
        if (downStart == 4) {
            position.downStart = 192;
            position.downEnd = 0;
            position.upStart = 0;
        }
        if (downStart == 3) {
            position.downStart = 120;
            position.downEnd = 0;
            position.upStart = 0;
        }
        if (downStart == 2) {
            position.downStart = 48;
        }
        if (downStart == 1) {
            position.downStart = 0;
        }
        
        if (downEnd == 3) {
            position.downEnd = 120;
            position.upStart = 0;
        }
        if (downStart == 2) {
            position.downEnd = 48;
        }
        if (downStart == 1) {
            position.downStart = 0;
        }

        if (upStart == 2) {
            position.upStart = 48;
        }
        if (upStart == 1) {
            position.upStart = 0;
        }
        setPosition({...position});
        return dksKey;
    }, [dksKey])

    const setDKS = (dks) => {
        onChange(dks);
    }

    const drag = (data, type) => {
        let p = Math.max(0, data.x);
        if (type == 'downStart') {
            if (dks.downEnd > 0) {
                p = Math.min(p, 48);
            } else if (dks.upStart > 0) {
                p = Math.min(p, 120);
            } else {
                p = Math.min(p, 192)
            }

            setNewPosition({...newPosition,
                downStart: p > 156 ? 192 : p > 84 ? 120 : p > 24 ? 48 : 0});
            setPosition({...position, 
                downStart: p
            })
        }

        if (type == 'downEnd') {
            
            if (dks.upStart > 0) {
                p = Math.min(p, 48);
            } else {
                p = Math.min(p, 120)
            }
            setNewPosition({...newPosition,
                downEnd: p > 84 ? 120 : p > 24 ? 48 : 0});
            setPosition({...position, 
                downEnd: p
            })
        }

        if (type == 'upStart') {
            p = Math.min(p, 48)
            setNewPosition({...newPosition,
                upStart: p > 24 ? 48 : 0});
            setPosition({...position, 
                upStart: p
            })
        }
    }

    const dragStop = (type) => {
        setDragItem('');

        if (type == 'downStart') {
            if (position.downStart > 156) {
                setPosition({...position, downStart: 192})
                setDKS({...dks, downStart: 4})
            } else if (position.downStart > 84) {
                setPosition({...position, downStart: 120})
                setDKS({...dks, downStart: 3})
            } else if (position.downStart > 24) {
                setPosition({...position, downStart: 48})
                setDKS({...dks, downStart: 2})
            } else {
                setPosition({...position, downStart: 0})
                setDKS({...dks, downStart: 1})
            }
        }
        if (type == 'downEnd') {
            if (position.downEnd > 84) {
                setPosition({...position, downEnd: 120})
                setDKS({...dks, downEnd: 3})
            } else if (position.downEnd > 24) {
                setPosition({...position, downEnd: 48})
                setDKS({...dks, downEnd: 2})
            } else {
                setPosition({...position, downEnd: 0})
                setDKS({...dks, downEnd: 1})
            }
        }
        if (type == 'upStart') {
            if (position.upStart > 24) {
                setPosition({...position, upStart: 48})
                setDKS({...dks, upStart: 2})
            } else {
                setPosition({...position, upStart: 0})
                setDKS({...dks, upStart: 1})
            }
        }
    }

    const showDKS = (type) => {
        switch (type) {
            case 'downStart':
                setDKS({...dks, downStart: dks.downStart > 0? 0 : 1})
                break;
            case 'downEnd':
                setDKS({...dks, downEnd: dks.downEnd > 0? 0 : 1})
                break;
            case 'upStart':
                setDKS({...dks, upStart: dks.upStart > 0? 0 : 1})
                break;
            case 'upEnd':
                setDKS({...dks, upEnd: dks.upEnd > 0? 0 : 1})
                break;
            default:
                break;
        }
    }

    return (
       <>
        <div className="relative select-none ml-2">
            <Button className="dks-down-start" onClick={() => {showDKS('downStart')}}>
                <i className="el-icon-plus text-lg font-bold text-w-1" />
            </Button>
            {dks.downStart == 0 ? <>
                <Draggable defaultClassName="absolute top-0 left-0 w-8 h-8 hover:cursor-pointer" axis="x" onDrag={(e, d) => drag(d, 'downStart')} onStop={() => dragStop('downStart')} position={{x:0, y:0}} onStart={() => setDragItem('downStart')}>
                <div></div>
                </Draggable>
            </> : <>
                <Draggable defaultClassName="dks-border-dragbox"  onDrag={(e, d) => drag(d, 'downStart')} onStop={() => dragStop('downStart')} position={{x:position.downStart, y:0}} onStart={() => setDragItem('downStart')}>
                    <div></div>
                </Draggable>
            </>} 
            {dragItem != 'downStart' ? dks.downStart > 0 ? <div className="drag-bar bg-blue-1"
                style={{width: `${position.downStart+28}px`}}
                onClick={(event) => {event.stopPropagation(); showDKS('downStart');}}>
                </div> : <></> : <>
                <div className="drag-bar bg-blue-1" style={{width: `${position.downStart+28}px`}}></div>
                <div className="drag-bar bg-blue-1" style={{width: `${newPosition.downStart+28}px`}}></div>
            </>}
        </div>
        <div className="relative ml-8">
            <Button className="dks-down-end" onClick={() => {showDKS('downEnd')}}>
               <i className="el-icon-plus text-lg font-bold text-w-1" />
            </Button>
            {dks.downEnd == 0 ? <>
                <Draggable defaultClassName="absolute top-0 left-0 w-8 h-8 hover:cursor-pointer" axis="x" onDrag={(e, d) => drag(d, 'downEnd')} onStop={() => dragStop('downEnd')} position={{x:0, y:0}} onStart={() => setDragItem('downEnd')}>
                <div></div>
                </Draggable>
            </> : <>
                <Draggable defaultClassName="dks-border-dragbox"  onDrag={(e, d) => drag(d, 'downEnd')} onStop={() => dragStop('downEnd')} position={{x:position.downEnd, y:0}} onStart={() => setDragItem('downEnd')}>
                    <div></div>
                </Draggable>
            </>} 
            {dragItem != 'downEnd' ? dks.downEnd > 0 ? <div className="drag-bar bg-blue-1"
                style={{width: `${position.downEnd+28}px`}}
                onClick={(event) => {event.stopPropagation(); showDKS('downEnd');}}>
                </div> : <></> : <>
                <div className="drag-bar bg-blue-1" style={{width: `${position.downEnd+28}px`}}></div>
                <div className="drag-bar bg-blue-1" style={{width: `${newPosition.downEnd+28}px`}}></div>
            </>}
        </div>
        <div></div>
        <div className="relative ml-2">
            <Button className="dks-up-start" onClick={() => showDKS('upStart')}>
               <i className="el-icon-plus text-lg font-bold text-w-1" />
            </Button>
            {dks.upStart == 0 ? <>
                <Draggable defaultClassName="absolute top-0 left-0 w-8 h-8 hover:cursor-pointer" axis="x" onDrag={(e, d) => drag(d, 'upStart')} onStop={() => dragStop('upStart')} position={{x:0, y:0}} onStart={() => setDragItem('upStart')}>
                <div></div>
                </Draggable>
            </> : <>
                <Draggable defaultClassName="dks-border-dragbox"  onDrag={(e, d) => drag(d, 'upStart')} onStop={() => dragStop('upStart')} position={{x:position.upStart, y:0}} onStart={() => setDragItem('upStart')}>
                    <div></div>
                </Draggable>
            </>} 
            {dragItem != 'upStart' ? dks.upStart > 0 ? <div className="drag-bar bg-blue-1"
                style={{width: `${position.upStart+28}px`}}
                onClick={(event) => {event.stopPropagation(); showDKS('upStart');}}>
                </div> : <></> : <>
                <div className="drag-bar bg-blue-1" style={{width: `${position.upStart+28}px`}}></div>
                <div className="drag-bar bg-blue-1" style={{width: `${newPosition.upStart+28}px`}}></div>
            </>}
        </div>
        <div className="relative ml-8">
            <Button className="dks-up-end" onClick={() => showDKS('upEnd')}>
               <i className="el-icon-plus text-lg font-bold text-w-1" />
            </Button>
            <div hidden={dks.upEnd == 0} _hidden={{display: 'none'}}>                     
                <div className="drag-bar bg-blue-1"
                style={{width: `1.375rem`}}
                onClick={(event) => {event.stopPropagation(); showDKS('upEnd');}}>
                </div>
            </div>
        </div>
        <div />
       </>
    );
}

export default DragKey;