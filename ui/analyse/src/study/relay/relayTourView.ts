import AnalyseCtrl from '../../ctrl';
import RelayCtrl from './relayCtrl';
import * as licon from 'common/licon';
import { bind, dataIcon, onInsert, looseH as h } from 'common/snabbdom';
import { VNode } from 'snabbdom';
import { innerHTML } from 'common/richText';
import { RelayRound } from './interfaces';
import { RelayTab } from '../interfaces';
import { view as multiBoardView } from '../multiBoard';
import { scrollToInnerSelector } from 'common';
import StudyCtrl from '../studyCtrl';
import { toggle } from 'common/controls';
import * as xhr from 'common/xhr';
import { domDialog } from 'common/dialog';

export default function (ctrl: AnalyseCtrl): VNode | undefined {
  const study = ctrl.study;
  const relay = study?.relay;
  if (!study || !relay?.tourShow()) return undefined;

  const makeTab = (key: RelayTab, name: string) =>
    h(
      'span.' + key,
      {
        class: { active: relay.tab() === key },
        attrs: { role: 'tab' },
        hook: bind('mousedown', () => relay.tab(key), relay.redraw),
      },
      name,
    );

  const tabs = h('div.tabs-horiz', { attrs: { role: 'tablist' } }, [
    makeTab('overview', 'Overview'),
    makeTab('schedule', 'Schedule'),
    relay.data.leaderboard ? makeTab('leaderboard', 'Leaderboard') : undefined,
  ]);
  const content =
    relay.tab() == 'overview'
      ? overview(relay, study, ctrl)
      : relay.tab() == 'schedule'
      ? schedule(relay)
      : leaderboard(relay);

  return h('div.relay-tour', [tabs, ...content]);
}

const leaderboard = (relay: RelayCtrl): VNode[] => {
  const players = relay.data.leaderboard || [];
  const withRating = players.find(p => p.rating);
  return [
    h('div.relay-tour__text', [
      h('h1', relay.data.tour.name),
      h('div.relay-tour__text__leaderboard', [
        h('table.slist.slist-invert', [
          h(
            'thead',
            h('tr', [
              h('th', h('h2', 'Leaderboard')),
              withRating ? h('th', 'Elo') : undefined,
              h('th', 'Score'),
              h('th', 'Games'),
            ]),
          ),
          h(
            'tbody',
            players.map(player =>
              h('tr', [
                h('th', player.name),
                withRating ? h('td', `${player.rating}`) : undefined,
                h('td', `${player.score}`),
                h('td', `${player.played}`),
              ]),
            ),
          ),
        ]),
      ]),
    ]),
  ];
};

const overview = (relay: RelayCtrl, study: StudyCtrl, ctrl: AnalyseCtrl) => {
  const round = relay.currentRound();
  return [
    h('div.relay-tour__text', [
      header(relay, ctrl),
      h(
        'a.relay-tour__round',
        {
          class: { ongoing: !!round.ongoing },
          attrs: { tabindex: 0 },
          hook: bind('click', () => $('span.chapters[role="tab"]').trigger('mousedown')),
        },
        [
          h('strong', round.name),
          ' ',
          round.ongoing
            ? study.trans.noarg('playingRightNow')
            : !!round.startsAt &&
              h(
                'time.timeago',
                { hook: onInsert(el => el.setAttribute('datetime', '' + round.startsAt)) },
                lichess.timeago(round.startsAt),
              ),
        ],
      ),
      relay.data.tour.markup
        ? h('div', { hook: innerHTML(relay.data.tour.markup, () => relay.data.tour.markup!) })
        : h('div', relay.data.tour.description),
    ]),
    !study.looksNew() && multiBoardView(study.multiBoard, study),
  ];
};

const header = (relay: RelayCtrl, ctrl: AnalyseCtrl) => {
  return h('span.overview-header', [
    h('h1', relay.data.tour.name),
    relay.data.isSubscribed !== undefined &&
      toggle(
        {
          name: 'Subscribe',
          id: 'tour-subscribe',
          checked: relay.data.isSubscribed,
          change: (v: boolean) => {
            xhr.text(`/broadcast/${relay.data.tour.id}/subscribe?set=${v}`, { method: 'post' });
            relay.data.isSubscribed = v;
            ctrl.redraw();
          },
        },
        ctrl.trans,
        ctrl.redraw,
      ),
    h('i', {
      attrs: { 'data-icon': licon.InfoCircle },
      hook: onInsert(el => {
        el.addEventListener('click', () => {
          domDialog({
            htmlText: `
<h2>Broadcast subscription</h2>
<p>Subscribe to be notified when each round starts.</p>
<p>Ensure that you have either bell or push notifications enabled for broadcasts in your <a href="/account/preferences/notification">notification settings</a>.</p>
          `,
            show: 'modal',
          });
        });
      }),
    }),
  ]);
};

const schedule = (relay: RelayCtrl): VNode[] => [
  h('div.relay-tour__text', [
    h('div.relay-tour__text__schedule', [
      h('h1', relay.data.tour.name),
      h('h2', 'Schedule'),
      h(
        'table.slist.slist-invert',
        h(
          'tbody',
          relay.data.rounds.map(round =>
            h('tr', [
              h('th', h('a.link', { attrs: { href: relay.roundPath(round) } }, round.name)),
              h('td', round.startsAt ? lichess.dateFormat()(new Date(round.startsAt)) : undefined),
              h(
                'td',
                roundStateIcon(round) || (round.startsAt ? lichess.timeago(round.startsAt) : undefined),
              ),
            ]),
          ),
        ),
      ),
    ]),
  ]),
];

const roundStateIcon = (round: RelayRound) =>
  round.ongoing
    ? h('ongoing', { attrs: { ...dataIcon(licon.DiscBig), title: 'Ongoing' } })
    : round.finished && h('finished', { attrs: { ...dataIcon(licon.Checkmark), title: 'Finished' } });

export function rounds(ctrl: StudyCtrl): VNode {
  const canContribute = ctrl.members.canContribute();
  const relay = ctrl.relay!;
  return h(
    'div.study__relay__rounds',
    { hook: onInsert(el => scrollToInnerSelector(el, '.active')) },
    relay.data.rounds
      .map(round =>
        h('div', { key: round.id, class: { active: ctrl.data.id == round.id } }, [
          h('a.link', { attrs: { href: relay.roundPath(round) } }, round.name),
          roundStateIcon(round),
          canContribute &&
            h('a.act', { attrs: { ...dataIcon(licon.Gear), href: `/broadcast/round/${round.id}/edit` } }),
        ]),
      )
      .concat(
        canContribute
          ? [
              h(
                'div.add',
                h(
                  'a.text',
                  {
                    attrs: { href: `/broadcast/${relay.data.tour.id}/new`, 'data-icon': licon.PlusButton },
                  },
                  ctrl.trans.noarg('addRound'),
                ),
              ),
            ]
          : [],
      ),
  );
}
