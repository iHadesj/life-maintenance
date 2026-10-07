import { motion, useTransform } from 'framer-motion';
import type { ReactNode } from 'react';
import { pageScrollY } from '../app/pageTransition';
import { maskRiseVariants } from '../motion/transitions';
import { fit } from './fit';
import s from './PageTitle.module.css';

interface Props {
  primary: string;
  /** Second line, drawn as an outline — the "path" part of the name. */
  secondary?: string;
  kicker?: ReactNode;
  children?: ReactNode;
}

/**
 * Big titles rise out of a mask on arrival and lag behind the scroll as the
 * header takes over — the name slides into the path bar instead of vanishing.
 * Each line is fitted to the measure, so the block reads as one justified slab.
 */
export function PageTitle({ primary, secondary, kicker, children }: Props) {
  const y = useTransform(pageScrollY, [0, 240], [0, 90]);
  const opacity = useTransform(pageScrollY, [0, 200], [1, 0]);

  return (
    <motion.header className={s.head} style={{ y, opacity }}>
      {kicker && <p className={s.kicker}>{kicker}</p>}
      <h1 className={s.title}>
        <motion.span className={`${s.line} fit`} style={fit(primary)} variants={maskRiseVariants} initial="hidden" animate="shown">
          {primary}
        </motion.span>
        {secondary && (
          <motion.span
            className={`${s.line} ${s.outline} fit`}
            style={fit(secondary)}
            variants={maskRiseVariants}
            initial="hidden"
            animate="shown"
            transition={{ delay: 0.08 }}
          >
            {secondary}
          </motion.span>
        )}
      </h1>
      {children}
    </motion.header>
  );
}
